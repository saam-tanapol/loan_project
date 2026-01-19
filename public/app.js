// --- สรุป Logic: ดอกเบี้ยไม่ทบต้น ---
// 1. ยอดกู้เพิ่ม/ลด จะไปคำนวณใน principal_balance (เงินต้น)
// 2. การคิดดอกเบี้ย จะคำนวณจาก principal_balance ล่าสุดเท่านั้น
// 3. รายการ 'ดอกเบี้ย' จะไม่ทำให้ principal_balance เพิ่มขึ้น

let transactions = [];
let settings = {};
let chartInstance = null;

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    await loadSettings();
    await fetchData();
    setupEventListeners();
}

// 1. จัดการการตั้งค่า
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        settings = await response.json();
        
        // อัปเดต UI เบื้องต้น
        document.getElementById('borrower-name').innerText = settings.borrowerName || 'ไม่ระบุชื่อ';
        document.getElementById('setting-borrower-name').value = settings.borrowerName || '';
        document.getElementById('setting-interest-rate').value = settings.interestRate || 5;
        document.getElementById('setting-start-date').value = settings.startDate || '';
        
        // เช็ค Dark Mode จาก Settings
        const isDark = settings.theme !== 'light';
        document.getElementById('darkModeToggle').checked = isDark;
        applyTheme(isDark);
    } catch (e) { console.error("Load settings error:", e); }
}

async function saveSettings() {
    const data = {
        borrowerName: document.getElementById('setting-borrower-name').value,
        interestRate: document.getElementById('setting-interest-rate').value,
        startDate: document.getElementById('setting-start-date').value
    };

    for (const [key, value] of Object.entries(data)) {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
    }
    location.reload(); // รีโหลดเพื่ออัปเดตค่าทั้งหมด
}

// 2. จัดการข้อมูลธุรกรรม
async function fetchData() {
    const response = await fetch('/api/loans');
    transactions = await response.json();
    updateUI();
}

async function saveTransaction(type) {
    const amount = parseFloat(document.getElementById('form-amount').value);
    const date = document.getElementById('form-date').value;
    const notes = document.getElementById('form-notes').value;

    if (!amount || !date) return alert('กรุณากรอกข้อมูลให้ครบ');

    const lastPrincipal = transactions.length > 0 ? transactions[0].principal_balance : 0;
    const lastTotalBalance = transactions.length > 0 ? transactions[0].balance : 0;

    // คำนวณเงินต้นใหม่ (Simple Interest: ดอกเบี้ยจะไม่มาบวกใน principal_balance)
    let newPrincipal = lastPrincipal;
    if (type === 'เพิ่ม') newPrincipal += amount;
    if (type === 'ลด') newPrincipal -= amount;

    const payload = {
        date,
        type,
        amount,
        balance: (type === 'เพิ่ม') ? lastTotalBalance + amount : lastTotalBalance - amount,
        principal_balance: newPrincipal,
        interest_accrued: 0,
        notes,
        interest_rate: settings.interestRate
    };

    await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    closeModal('loan-modal');
    fetchData();
}

// 3. ระบบคำนวณดอกเบี้ย (ไม่ทบต้น)
async function calculateSimpleInterest() {
    const lastPrincipal = transactions.length > 0 ? transactions[0].principal_balance : 0;
    if (lastPrincipal <= 0) return alert('ไม่มียอดเงินต้นคงเหลือสำหรับคำนวณดอกเบี้ย');

    const rate = parseFloat(settings.interestRate);
    const interestAmount = (lastPrincipal * rate) / 100;

    if (confirm(`คิดดอกเบี้ย ${rate}% จากเงินต้น ${lastPrincipal.toLocaleString()} บาท\nรวมเป็นดอกเบี้ย: ${interestAmount.toLocaleString()} บาท (ไม่ทบเงินต้น)`)) {
        const payload = {
            date: new Date().toISOString().split('T')[0],
            type: 'ดอกเบี้ย',
            amount: interestAmount,
            balance: (transactions.length > 0 ? transactions[0].balance : 0) + interestAmount,
            principal_balance: lastPrincipal, // สำคัญ: เงินต้นคงเท่าเดิม ไม่เพิ่มขึ้น
            interest_accrued: interestAmount,
            notes: `ดอกเบี้ยประจำเดือน (${rate}%)`,
            interest_rate: rate
        };

        await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        fetchData();
    }
}

// 4. ส่วนแสดงผล UI
function updateUI() {
    const tbody = document.getElementById('transaction-body');
    tbody.innerHTML = '';
    
    let totalInt = 0;
    let totalRepaid = 0;
    let totalLoaned = 0;

    transactions.forEach(t => {
        if (t.type === 'ดอกเบี้ย') totalInt += t.amount;
        if (t.type === 'ลด') totalRepaid += t.amount;
        if (t.type === 'เพิ่ม') totalLoaned += t.amount;

        tbody.innerHTML += `
            <tr class="border-b border-gray-800 light:border-gray-200 hover:bg-cyan-500/5 transition">
                <td class="p-4 font-mono text-sm">${t.date}</td>
                <td class="p-4"><span class="px-2 py-0.5 rounded text-xs font-bold uppercase ${getTypeClass(t.type)}">${t.type}</span></td>
                <td class="p-4 text-right font-mono ${t.type === 'ลด' ? 'text-green-400' : 'text-cyan-400'}">${t.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="p-4 text-right font-mono text-gray-400">${t.principal_balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="p-4 text-right font-mono text-purple-400">${t.interest_accrued > 0 ? t.interest_accrued.toLocaleString() : '-'}</td>
                <td class="p-4 text-xs text-gray-500">${t.notes || ''}</td>
            </tr>
        `;
    });

    const currentPrincipal = transactions.length > 0 ? transactions[0].principal_balance : 0;
    
    document.getElementById('current-principal').innerText = currentPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('total-loaned').innerText = totalLoaned.toLocaleString() + ' บาท';
    document.getElementById('total-interest-accrued').innerText = totalInt.toLocaleString() + ' บาท';
    document.getElementById('total-repaid').innerText = totalRepaid.toLocaleString() + ' บาท';
    
    updateChart();
}

// 5. Utilities
function getTypeClass(type) {
    if (type === 'เพิ่ม') return 'bg-cyan-900/50 text-cyan-400 border border-cyan-500';
    if (type === 'ลด') return 'bg-green-900/50 text-green-400 border border-green-500';
    return 'bg-purple-900/50 text-purple-400 border border-purple-500';
}

function applyTheme(isDark) {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
}

function setupEventListeners() {
    document.getElementById('darkModeToggle').addEventListener('change', (e) => {
        applyTheme(e.target.checked);
        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'theme', value: e.target.checked ? 'dark' : 'light' })
        });
    });
}

function openModal(id, event) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    if (id === 'loan-modal' && event) {
        document.getElementById('form-date').valueAsDate = new Date();
        // ดึงข้อความจากปุ่มที่กด (เช่น "เพิ่มยอดกู้" หรือ "ลดยอดกู้")
        const buttonText = event.target.innerText;
        document.getElementById('modal-loan-title').innerText = buttonText;
        
        const saveBtn = document.getElementById('save-loan-btn');
        
        // กำหนดการทำงานของปุ่มบันทึกใหม่ทุกครั้งที่เปิด Modal
        if (buttonText.includes('เพิ่ม')) {
            saveBtn.onclick = () => saveTransaction('เพิ่ม');
        } else {
            saveBtn.onclick = () => saveTransaction('ลด');
        }
    }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function updateChart() {
    const ctx = document.getElementById('loanChart').getContext('2d');
    const chartData = [...transactions].reverse().slice(-10);
    
    if (chartInstance) chartInstance.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const accentColor = isDark ? '#00e6e6' : '#2563eb';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(t => t.date),
            datasets: [{
                data: chartData.map(t => t.principal_balance),
                borderColor: accentColor,
                backgroundColor: isDark ? 'rgba(0, 230, 230, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: isDark ? '#1f2937' : '#e5e7eb' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

function exportData() {
    let csv = "วันที่,ประเภท,จำนวนเงิน,เงินต้นคงเหลือ,ดอกเบี้ยรายการนี้,หมายเหตุ\n";
    transactions.forEach(t => {
        csv += `${t.date},${t.type},${t.amount},${t.principal_balance},${t.interest_accrued},${t.notes}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `loan_report_${settings.borrowerName || 'export'}.csv`;
    link.click();
}

async function confirmReset() {
    if (confirm('ยืนยันการลบข้อมูลทั้งหมด?')) {
        await fetch('/api/reset', { method: 'DELETE' });
        location.reload();
    }
}