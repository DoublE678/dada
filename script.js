"use strict";

let cpuData = [];
let selected = [];
let csvHeaders = [];
let sortState = { column: null, dir: 1 };

/* конфиг */

const HIDDEN_COLUMNS = new Set(["ID"]);

const NON_SORTABLE = new Set([
  "Codename", "Code Name", "Коднейм",
  "Socket", "Сокет",
  "Release", "Release date", "Дата выхода", "Год выпуска", "Year"
]);

const INVERT_BETTER = new Set([
  "Process", "Process (nm)", "Техпроцесс",
  "TDP"
]);

const HEADER_RENAME = {
  "L3_Cache": "Cache L3",
};

const searchInput   = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const selectedList  = document.getElementById("selectedList");
const compareHead   = document.getElementById("compareHead");
const compareBody   = document.getElementById("compareBody");

/* csv */
fetch("tpu_cpus.csv")
  .then(r => r.text())
  .then(text => {
    cpuData = parseCSV(text);
  })
  .catch(() => alert("CSV не загрузился. Проверь, что tpu_cpus.csv рядом и сайт запущен через сервер."));

/* парсер */
function splitCsvLine(line) {
  const out = [];
  let cur = "", inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const originalHeaders = splitCsvLine(lines[0]);

  const kept = [];
  for (let i = 0; i < originalHeaders.length; i++) {
    if (i === 0) continue;
    kept.push({ name: originalHeaders[i].trim(), idx: i });
  }

  // заголовки , которые будем показывать в таблице
  csvHeaders = kept.map(k => k.name);

  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const vals = splitCsvLine(lines[li]);
    const obj = {};

    for (const k of kept) {
      obj[k.name] = (vals[k.idx] ?? "").trim();
    }

    if (obj.Name) rows.push(obj);
  }

  return rows;
}


function parseNumber(val) {
  if (!val) return NaN;
  const num = parseFloat(String(val).replace(",", "."));
  return Number.isFinite(num) ? num : NaN;
}

function alphaNumKey(name) {
  const m = String(name).match(/(\d+)/);
  return { text: String(name).toLowerCase(), num: m ? parseInt(m[1], 10) : 0 };
}

function hideResults() {
  searchResults.classList.add("hidden");
  searchResults.innerHTML = "";
}

function showResults() {
  searchResults.classList.remove("hidden");
}


searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) return hideResults();

  const parts = q.split(/\s+/).filter(Boolean);

  const res = cpuData
    .filter(cpu => {
      const name = (cpu.Name || "").toLowerCase();
      return parts.every(p => name.includes(p));
    })
    .slice(0, 12); 

  renderResults(res);
});

function renderResults(list) {
  searchResults.innerHTML = "";

  if (!list.length) {
    const div = document.createElement("div");
    div.className = "searchItem";
    div.style.opacity = "0.85";
    div.textContent = "Ничего не найдено";
    searchResults.appendChild(div);
    showResults();
    return;
  }

  list.forEach(cpu => {
    const div = document.createElement("div");
    div.className = "searchItem";
    div.textContent = cpu.Name;
    div.dataset.name = cpu.Name;
    searchResults.appendChild(div);
  });

  showResults();
}

searchResults.addEventListener("click", (e) => {
  const item = e.target.closest(".searchItem");
  if (!item) return;
  const name = item.dataset.name;
  if (!name) return;

  const cpu = cpuData.find(c => c.Name === name);
  if (cpu) addCPU(cpu);
});


document.addEventListener("click", (e) => {
  if (e.target === searchInput) return;
  if (searchResults.contains(e.target)) return;
  hideResults();
});

/* процы */
function addCPU(cpu) {
  if (selected.some(c => c.Name === cpu.Name)) {
    searchInput.value = "";
    hideResults();
    return;
  }
  if (selected.length >= 5) {
    alert("Максимум 5 процессоров");
    return;
  }

  selected.push(cpu);

  searchInput.value = "";
  hideResults();

  renderSelected();
  renderTable();
}

function removeCPU(name) {
  selected = selected.filter(c => c.Name !== name);
  renderSelected();
  renderTable();
}

function renderSelected() {
  selectedList.innerHTML = "";
  selected.forEach(cpu => {
    const chip = document.createElement("div");
    chip.className = "selectedCpu";

    const btn = document.createElement("div");
    btn.className = "removeBtn";
    btn.textContent = "✕";
    btn.onclick = () => removeCPU(cpu.Name);

    const text = document.createElement("span");
    text.textContent = cpu.Name;

    chip.append(btn, text);
    selectedList.appendChild(chip);
  });
}

/* табица */
function renderTable() {
  compareHead.innerHTML = "";
  compareBody.innerHTML = "";
  if (!selected.length) return;

  const trH = document.createElement("tr");
  csvHeaders.forEach(h => {
    const th = document.createElement("th");
    th.textContent = HEADER_RENAME[h] || h;

    if (!NON_SORTABLE.has(h)) {
      th.classList.add("sortable");
      if (sortState.column === h) th.classList.add(sortState.dir === 1 ? "asc" : "desc");
      th.onclick = () => toggleSort(h);
    }

    trH.appendChild(th);
  });
  compareHead.appendChild(trH);

  if (sortState.column) {
    const col = sortState.column;

    selected.sort((a, b) => {
      const av = parseNumber(a[col]);
      const bv = parseNumber(b[col]);

      if (!isNaN(av) && !isNaN(bv) && av !== bv) {
        return (av - bv) * sortState.dir;
      }

      const ak = alphaNumKey(a.Name);
      const bk = alphaNumKey(b.Name);
      if (ak.text !== bk.text) return ak.text.localeCompare(bk.text);
      return ak.num - bk.num;
    });
  }

  const stats = {};
  csvHeaders.forEach(h => {
    const nums = selected.map(c => parseNumber(c[h])).filter(n => !isNaN(n));
    if (nums.length > 1) {
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      if (min !== max) stats[h] = { min, max };
    }
  });

  selected.forEach(cpu => {
    const tr = document.createElement("tr");

    csvHeaders.forEach(h => {
      const td = document.createElement("td");
      const val = cpu[h] || "—";
      td.textContent = val;

      const num = parseNumber(val);
      if (!isNaN(num) && stats[h]) {
        const invert = INVERT_BETTER.has(h); 
        if (invert) {
          if (num === stats[h].min) td.classList.add("bestValue");
          if (num === stats[h].max) td.classList.add("worstValue");
        } else {
          if (num === stats[h].max) td.classList.add("bestValue");
          if (num === stats[h].min) td.classList.add("worstValue");
        }
      }

      tr.appendChild(td);
    });

    compareBody.appendChild(tr);
  });
}

function toggleSort(col) {
  if (sortState.column === col) sortState.dir *= -1;
  else { sortState.column = col; sortState.dir = 1; }
  renderTable();
}
