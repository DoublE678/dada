let cpuData = [];
let filteredData = [];
const selectedNames = new Set();

// Колонки, которые будем предлагать для сравнения (популярные + безопасные)
const DEFAULT_COLUMNS = [
  "Name",
  "Clock",
  "Cores",
  "Threads",
  "TDP",
  "L3_Cache",
  "L2_Cache",
  "Socket",
  "Process",
  "Max_Memory",
  "PCIe",
];

// Человекочитаемые названия колонок
const COLUMN_LABELS = {
  Name: "Название",
  Clock: "Частота",
  Cores: "Ядра",
  Threads: "Потоки",
  TDP: "TDP (W)",
  L3_Cache: "Кэш L3",
  L2_Cache: "Кэш L2",
  Socket: "Сокет",
  Process: "Техпроцесс",
  Max_Memory: "Макс. память",
  PCIe: "PCIe",
};

const els = {
  search: document.getElementById("search"),
  catalogBody: document.getElementById("catalogBody"),
  compareHead: document.getElementById("compareHead"),
  compareBody: document.getElementById("compareBody"),
  columnsBox: document.getElementById("columnsBox"),
  selectedCount: document.getElementById("selectedCount"),
  totalCount: document.getElementById("totalCount"),
  filteredCount: document.getElementById("filteredCount"),
  clearSelection: document.getElementById("clearSelection"),
  themeSelect: document.getElementById("themeSelect"),
};

let allHeaders = [];
let enabledColumns = new Set(); // какие параметры показывать в сравнении

init();

function init() {
  // Тема
  els.themeSelect.addEventListener("change", () => {
    document.body.setAttribute("data-theme", els.themeSelect.value);
  });

  // Поиск
  els.search.addEventListener("input", () => {
    applyFilter();
    renderCatalog();
    renderCompare();
  });

  // Очистка выбора
  els.clearSelection.addEventListener("click", () => {
    selectedNames.clear();
    updateCounters();
    renderCatalog();
    renderCompare();
  });

  loadCSV("tpu_cpus.csv");
}

function loadCSV(path) {
  fetch(path)
    .then((res) => res.text())
    .then((text) => parseCSV(text))
    .catch((err) => {
      console.error(err);
      alert("Не удалось загрузить CSV. Убедись, что tpu_cpus.csv рядом с index.html и сайт запущен через сервер.");
    });
}

/**
 * CSV парсер с поддержкой кавычек.
 * Не идеальный для всех edge-case, но сильно надёжнее split(',').
 */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // двойные кавычки внутри quoted-поля -> ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    alert("CSV пустой или некорректный.");
    return;
  }

  allHeaders = splitCsvLine(lines[0]).map((h) => h.trim());
  cpuData = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    allHeaders.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    cpuData.push(processCPU(row));
  }

  // Какие колонки доступны и включены по умолчанию
  const available = new Set(allHeaders);
  enabledColumns = new Set(
    DEFAULT_COLUMNS.filter((c) => available.has(c) && c !== "Name")
  );

  renderColumnsUI();
  applyFilter();
  updateCounters();
  renderCatalog();
  renderCompare();
}

function processCPU(cpu) {
  // Добавим нормализованные поля, если нужно где-то сортировать/считать
  cpu._effectiveCores = parseCores(cpu.Cores);
  cpu._maxClockGHz = parseClock(cpu.Clock);
  return cpu;
}

function parseCores(value) {
  if (!value) return 0;
  if (value.includes("/")) {
    const parts = value.split("/").map((v) => parseInt(v, 10)).filter(Number.isFinite);
    return parts.length ? Math.max(...parts) : 0;
  }
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function parseClock(value) {
  if (!value) return 0;
  // примеры: "3.6", "3.6 to 4.2", "4200 MHz"
  const v = value.toLowerCase();

  if (v.includes("to")) {
    const parts = v.split("to").map((x) => parseFloat(x));
    const max = parts[1];
    return Number.isFinite(max) ? max : 0;
  }

  if (v.includes("mhz")) {
    const num = parseFloat(v);
    return Number.isFinite(num) ? num / 1000 : 0;
  }

  const num = parseFloat(v);
  return Number.isFinite(num) ? num : 0;
}

function renderColumnsUI() {
  els.columnsBox.innerHTML = "";

  // Покажем только адекватные колонки (без пустых названий)
  // Name выводим всегда, поэтому в чекбоксах не показываем.
  const candidates = Array.from(new Set(DEFAULT_COLUMNS.concat(allHeaders)))
    .filter((c) => c && c !== "Name" && allHeaders.includes(c));

  candidates.forEach((col) => {
    const chip = document.createElement("label");
    chip.className = "chip";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = enabledColumns.has(col);

    cb.addEventListener("change", () => {
      if (cb.checked) enabledColumns.add(col);
      else enabledColumns.delete(col);
      renderCompare();
    });

    const title = document.createElement("span");
    title.textContent = COLUMN_LABELS[col] || col;

    chip.appendChild(cb);
    chip.appendChild(title);
    els.columnsBox.appendChild(chip);
  });
}

function applyFilter() {
  const q = (els.search.value || "").toLowerCase().trim();

  if (!q) {
    filteredData = cpuData.slice();
  } else {
    filteredData = cpuData.filter((c) => (c.Name || "").toLowerCase().includes(q));
  }

  updateCounters();
}

function updateCounters() {
  els.totalCount.textContent = String(cpuData.length);
  els.filteredCount.textContent = String(filteredData.length);
  els.selectedCount.textContent = String(selectedNames.size);
}

function renderCatalog() {
  els.catalogBody.innerHTML = "";

  // Чтобы было удобно, ограничим каталог по результатам поиска.
  // (Можно убрать лимит, если хочешь.)
  const maxRows = 200;
  const rows = filteredData.slice(0, maxRows);

  rows.forEach((cpu) => {
    const tr = document.createElement("tr");

    const tdCheck = document.createElement("td");
    tdCheck.className = "col-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedNames.has(cpu.Name);

    cb.addEventListener("change", () => {
      if (cb.checked) selectedNames.add(cpu.Name);
      else selectedNames.delete(cpu.Name);
      updateCounters();
      renderCompare();
    });

    tdCheck.appendChild(cb);

    tr.appendChild(tdCheck);
    tr.appendChild(tdText(cpu.Name));
    tr.appendChild(tdText(cpu._maxClockGHz ? cpu._maxClockGHz.toFixed(2) : "—"));
    tr.appendChild(tdText(cpu._effectiveCores || "—"));
    tr.appendChild(tdText(cpu.TDP || "—"));
    tr.appendChild(tdText(cpu.Socket || "—"));

    els.catalogBody.appendChild(tr);
  });

  if (filteredData.length > maxRows) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.opacity = "0.85";
    td.textContent = Показаны первые ${maxRows} строк. Уточни поиск, чтобы найти нужный CPU быстрее.;
    tr.appendChild(td);
    els.catalogBody.appendChild(tr);
  }
}

function tdText(value) {
  const td = document.createElement("td");
  td.textContent = value ?? "—";
  return td;
}

function renderCompare() {
  // Заголовок таблицы
  const cols = Array.from(enabledColumns);

  els.compareHead.innerHTML = "";
  const headTr = document.createElement("tr");

  headTr.appendChild(thText("Название"));
  cols.forEach((c) => headTr.appendChild(thText(COLUMN_LABELS[c] || c)));

  els.compareHead.appendChild(headTr);

  // Тело таблицы
  els.compareBody.innerHTML = "";

  const selected = cpuData.filter((c) => selectedNames.has(c.Name));
  if (selected.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 1 + cols.length;
    td.style.opacity = "0.85";
    td.textContent = "Ничего не выбрано. Отметь процессоры в каталоге ниже.";
    tr.appendChild(td);
    els.compareBody.appendChild(tr);
    return;
  }

  selected.forEach((cpu) => {
    const tr = document.createElement("tr");
    tr.appendChild(tdText(cpu.Name));

    cols.forEach((c) => {
      let v = cpu[c];

      // Чуть более читаемые значения для некоторых полей
      if (c === "Clock") {
        v = cpu._maxClockGHz ? ${cpu._maxClockGHz.toFixed(2)} GHz : (cpu.Clock || "—");
      } else if (c === "Cores") {
        v = cpu.Cores  (cpu._effectiveCores  "—");
      }

      tr.appendChild(tdText(v || "—"));
    });

    els.compareBody.appendChild(tr);
  });
}

function thText(value) {
  const th = document.createElement("th");
  th.textContent = value ?? "";
  return th;
}