let cpuData = [];
let selected = { 1: null, 2: null };

fetch('tpu_cpus.csv')
    .then(r => r.text())
    .then(parseCSV);

function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        const values = lines[i].split(',');
        let row = {};
        headers.forEach((h, j) => row[h.trim()] = values[j]?.trim());
        cpuData.push(processCPU(row));
    }

    initPicker(1);
    initPicker(2);
}

function processCPU(cpu) {
    cpu.effectiveCores = parseCores(cpu.Cores);
    cpu.maxClock = parseClock(cpu.Clock);
    return cpu;
}

function parseCores(v) {
    if (!v) return 0;
    if (v.includes('/')) return Math.max(...v.split('/').map(Number));
    return parseInt(v);
}

function parseClock(v) {
    if (!v) return 0;
    if (v.includes('to')) return parseFloat(v.split('to')[1]);
    if (v.includes('MHz')) return parseFloat(v) / 1000;
    return parseFloat(v);
}

/* ===== PICKER LOGIC ===== */

function initPicker(id) {
    const input = document.getElementById(search${id});
    const list = document.getElementById(list${id});

    input.addEventListener('focus', () => showList(id, ''));
    input.addEventListener('input', e => showList(id, e.target.value));

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.style.display = 'none';
        }
    });
}

function showList(id, query) {
    const list = document.getElementById(list${id});
    list.innerHTML = '';

    cpuData
        .filter(c => c.Name.toLowerCase().includes(query.toLowerCase()))
        .forEach(cpu => {
            const item = document.createElement('div');
            item.textContent = cpu.Name;
            item.onclick = () => selectCPU(id, cpu);
            list.appendChild(item);
        });

    list.style.display = 'block';
}

function selectCPU(id, cpu) {
    document.getElementById(search${id}).value = cpu.Name;
    document.getElementById(list${id}).style.display = 'none';
    selected[id] = cpu;
    renderComparison();
}

/* ===== COMPARISON TABLE ===== */

function renderComparison() {
    const t = document.getElementById('compare-table');
    t.innerHTML = '';

    const rows = [
        ['Частота (GHz)', c => c?.maxClock],
        ['Ядра', c => c?.effectiveCores],
        ['TDP (W)', c => c?.TDP],
        ['Кэш L3', c => c?.L3_Cache],
        ['Сокет', c => c?.Socket]
    ];

    rows.forEach(([label, fn]) => {
        t.innerHTML += 
            <tr>
                <td>${label}</td>
                <td>${fn(selected[1]) || '—'}</td>
                <td>${fn(selected[2]) || '—'}</td>
            </tr>
        ;
    });
}