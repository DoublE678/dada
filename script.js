"use strict";

let cpuData = [];
let selected = []; // массив объектов cpu

// DOM
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const selectedList = document.getElementById("selectedList");
const compareBody = document.getElementById("compareBody");

// ---- Load CSV ----
fetch("tpu_cpus.csv")
  .then((r) => r.text())
  .then((text) => {
    cpuData = parseCSV(text);
  })
  .catch((e) => {
    console.error(e);
    alert("Не удалось загрузить tpu_cpus.csv. Запусти сайт через локальный сервер (Live Server / python -m http.server).");
  });

// Надёжный CSV splitter (учитывает кавычки)
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
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
  return out.map((s) => s.trim());
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  const headers = splitCsvLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });
    if (obj.Name) rows.push(obj);
  }
  return rows;
}

// ---- Search + Suggestions ----
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();

  if (!q) {
    hideResults();
    return;
  }

  const results = cpuData
    .filter((cpu) => cpu.Name && cpu.Name.toLowerCase().includes(q))
    .slice(0, 12);

  renderResults(results);
});

function renderResults(items) {
  searchResults.innerHTML = "";

  if (items.length === 0) {
    const div = document.createElement("div");
    div.className = "searchItem";
    div.style.opacity = "0.85";
    div.textContent = "Ничего не найдено";
    searchResults.appendChild(div);
    showResults();
    return;
  }

  items.forEach((cpu) => {
    const div = document.createElement("div");
    div.className = "searchItem";
    div.textContent = cpu.Name;
    div.dataset.name = cpu.Name; // важно
    searchResults.appendChild(div);
  });

  showResults();
}

function showResults() {
  searchResults.classList.remove("hidden");
}
function hideResults() {
  searchResults.classList.add("hidden");
  searchResults.innerHTML = "";
}

// клик по подсказке — добавляем CPU (без inline onclick)
searchResults.addEventListener("click", (e) => {
  const item = e.target.closest(".searchItem");
  if (!item) return;

  const name = item.dataset.name;
  if (!name) return;

  const cpu = cpuData.find((c) => c.Name === name);
  if (!cpu) return;

  addCPU(cpu);
});

// клики вне поиска — закрыть подсказки
document.addEventListener("click", (e) => {
  if (e.target === searchInput) return;
  if (searchResults.contains(e.target)) return;
  hideResults();
});

// ---- Selected chips ----
function addCPU(cpu) {
  // уже выбран
  if (selected.some((c) => c.Name === cpu.Name)) {
    searchInput.value = "";
    hideResults();
    return;
  }

  // лимит 5
  if (selected.length >= 5) {
    alert("Можно сравнивать максимум 5 процессоров");
    return;
  }

  selected.push(cpu);

  searchInput.value = "";
  hideResults();

  renderSelected();
  renderTable();
}

function removeCPUByName(name) {
  selected = selected.filter((c) => c.Name !== name);
  renderSelected();
  renderTable();
}

// Рендер выбранных CPU: создаём DOM-элементы + addEventListener (кнопки точно работают)
function renderSelected() {
  selectedList.innerHTML = "";

  selected.forEach((cpu) => {
    const chip = document.createElement("div");
    chip.className = "selectedCpu";


    const btn = document.createElement("div");
    btn.className = "removeBtn";
    btn.textContent = "✕";
    btn.dataset.name = cpu.Name;

    const text = document.createElement("span");
    text.textContent = cpu.Name;

    // ВОТ ТУТ КНОПКА РАБОТАЕТ ГАРАНТИРОВАННО
    btn.addEventListener("click", () => removeCPUByName(cpu.Name));

    chip.appendChild(btn);
    chip.appendChild(text);
    selectedList.appendChild(chip);
  });
}

// ---- Table ----
function renderTable() {
  compareBody.innerHTML = "";

  selected.forEach((cpu) => {
    const tr = document.createElement("tr");

    tr.appendChild(td(cpu.Name));
    tr.appendChild(td(toClockGHz(cpu.Clock)));
    tr.appendChild(td(cpu.Cores || "—"));
    tr.appendChild(td(cpu.TDP || "—"));
    tr.appendChild(td(cpu.Socket || "—"));

    compareBody.appendChild(tr);
  });
}

function td(value) {
  const el = document.createElement("td");
  el.textContent = value ?? "—";
  return el;
}

function toClockGHz(clockField) {
  if (!clockField) return "—";

  const v = String(clockField).toLowerCase();

  // "4200 MHz"
  if (v.includes("mhz")) {
    const num = parseFloat(v);
    return Number.isFinite(num) ? (num / 1000).toFixed(2) : "—";
  }

  // "3.6 to 4.2"
  if (v.includes("to")) {
    const parts = v.split("to").map((x) => parseFloat(x));
    const max = parts[1];
    return Number.isFinite(max) ? max.toFixed(2) : "—";
  }

  const num = parseFloat(v);
  return Number.isFinite(num) ? num.toFixed(2) : "—";
}
