const SUPABASE_URL = 'https://argeyfcbyhgrsiobsoko.supabase.co/';
const SUPABASE_KEY = 'sb_publishable_h8uJKRKLrEtv249ProXrCQ_CbW0yYwZ';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const insideLabelsPlugin = {
    id: 'insideLabelsPlugin',
    afterDatasetsDraw(chart) {
        const { ctx, data, scales: { x, y } } = chart;
        ctx.save();
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px sans-serif';
        
        chart.getDatasetMeta(0).data.forEach((bar, index) => {
            const label = data.labels[index];
            const xPos = x.getPixelForValue(0) + 10;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, xPos, bar.y + 1);
        });
        ctx.restore();
    }
};

function cleanUrlError(message) {
    // loadToast(message);
    const title = document.getElementById('title');
    const content = document.getElementById('census-content');

    if (title) title.textContent = 'Oops!';
    if (content) {
        content.innerHTML = `
            <div class="surface-card code-card" style="text-align: center;">
                <h2>${message}</h2>
                <button type="button" class="btn-pop secondary" style="margin-top: 20px;" onclick="window.location.href='../silly-census/'">Go Back Home</button>
            </div>
        `;
    }
}

function enterForm(code) {
    if (!code || !code.trim()) {
        loadToast('Please enter a valid form code.');
        return;
    }
    window.location.href = `form?id=${encodeURIComponent(code.trim().toUpperCase())}`;
}

function getTimeRemaining(releaseDateIso) {
    const diff = new Date(releaseDateIso).getTime() - Date.now();
    if (diff <= 0) return 'a few moments';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

    return parts.join(', ');
}

document.addEventListener('DOMContentLoaded', async () => {
    const fiveDaysAgo = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString();
    await db.from('censuses').delete().lt('release_date', fiveDaysAgo);

    const urlParams = new URLSearchParams(window.location.search);
    const formCode = urlParams.get('id');

    if (formCode) {
        await loadCensusView(formCode.toUpperCase());
    }
});

async function loadCensusView(code) {
    const { data: census, error } = await db.from('censuses').select('*').eq('id', code).single();

    if (error || !census) {
        cleanUrlError('Invalid game code! Census not found.');
        return;
    }

    const releaseTime = new Date(census.release_date).getTime();
    const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;

    if (Date.now() > releaseTime + fiveDaysInMillis) {
        await db.from('censuses').delete().eq('id', code);
        cleanUrlError('This census has expired and been removed.');
        return;
    }

    const title = document.getElementById('title');
    const contentDiv = document.getElementById('census-content');

    if (title) title.textContent = `Census #${census.id}`;
    if (contentDiv) contentDiv.innerHTML = '';

    if (Date.now() >= releaseTime) {
        await renderGraphResults(census, contentDiv);
    } else {
        renderAnsweringGridForm(census, contentDiv);
    }
}

function renderAnsweringGridForm(census, container) {
    const answered = JSON.parse(localStorage.getItem('answered_censuses') || '[]');
    const form = document.createElement('form');
    form.id = 'active-survey-form';
    form.noValidate = true;

    if (answered.includes(census.id)) {
        const timeRemaining = getTimeRemaining(census.release_date);
        form.innerHTML = `
            <div class="surface-card code-card" style="text-align: center;">
                <h2>You have already answered this census!</h2>
                <p style="margin-top: 10px; font-size: 1.1rem;">The results will be made public in <strong>${timeRemaining}</strong>.</p>
                <button type="button" class="btn-pop secondary" style="margin-top: 20px;" onclick="window.location.href='../silly-census/'">Back to Home</button>
            </div>
        `;
        container.appendChild(form);
        return;
    }

    census.questions.forEach((q, idx) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'surface-card code-card';
        qDiv.style.marginBottom = '20px';
        
        const isReq = q.required ? ' <span style="color: #bf0811;">*</span>' : '';
        qDiv.innerHTML = `<h3 style="font-size: 1.5rem; margin-bottom: 15px;">${idx + 1}. ${q.text}${isReq}</h3>`;

        if (q.type === 'friend_select') {
            const grid = document.createElement('div');
            grid.style.display = 'flex';
            grid.style.flexWrap = 'wrap';
            grid.style.gap = '10px';

            census.friends.forEach(friend => {
                const label = document.createElement('label');
                label.className = 'question-chip';
                label.style.cursor = 'pointer';
                label.style.display = 'inline-flex';
                label.style.alignItems = 'center';
                label.style.gap = '8px';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = `q_${idx}`;
                input.value = friend;
                input.style.width = '18px';
                input.style.height = '18px';

                
                input.addEventListener('change', () => {
                    if (input.checked) {
                        label.style.background = 'oklch(0.968 0.008 60 / 30%)';
                        label.style.borderColor = 'oklch(0.968 0.008 60)';
                    } else {
                        label.style.background = 'oklch(0.968 0.008 60 / 10%)';
                        label.style.borderColor = 'oklch(0.968 0.008 60 / 40%)';
                    }
                });

                const labelText = document.createElement('span');
                labelText.textContent = friend;

                label.appendChild(input);
                label.appendChild(labelText);
                grid.appendChild(label);
            });
            qDiv.appendChild(grid);
        } else {
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'code-input';
            textInput.name = `q_${idx}`;
            textInput.placeholder = "Type your answer...";
            textInput.style.marginTop = '0';
            if (q.required) textInput.required = true;
            qDiv.appendChild(textInput);
        }

        form.appendChild(qDiv);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-pop small';
    submitBtn.style.width = '100%';
    submitBtn.style.marginTop = '10px';
    submitBtn.textContent = 'Submit Answers';
    form.appendChild(submitBtn);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const answers = {};

        for (let idx = 0; idx < census.questions.length; idx++) {
            const q = census.questions[idx];
            const qKey = `q_${idx}`;

            if (q.type === 'friend_select') {
                const selected = Array.from(form.querySelectorAll(`input[name="${qKey}"]:checked`)).map(c => c.value);
                if (q.required && selected.length === 0) {
                    loadToast(`Hold up! You missed question ${idx + 1}.`);
                    return;
                }
                answers[qKey] = selected;
            } else {
                const val = form.elements[qKey].value.trim();
                if (q.required && !val) {
                    loadToast(`Hold up! You missed question ${idx + 1}.`);
                    return;
                }
                answers[qKey] = val;
            }
        }

        const { error } = await db.from('responses').insert([{ census_id: census.id, answers: answers }]);

        if (error) {
            loadToast('Submission failed: ' + error.message);
        } else {
            answered.push(census.id);
            localStorage.setItem('answered_censuses', JSON.stringify(answered));
            const timeRemaining = getTimeRemaining(census.release_date);
            form.innerHTML = `
                <div class="surface-card code-card" style="text-align: center;">
                    <h2>Thank you! Your answers are locked in.</h2>
                    <p style="margin-top: 10px; font-size: 1.1rem;">The results will be made public in <strong>${timeRemaining}</strong>.</p>
                    <button type="button" class="btn-pop secondary" style="margin-top: 20px;" onclick="window.location.href='../silly-census/'">Back to Home</button>
                </div>
            `;
        }
    });

    container.appendChild(form);
}

async function renderGraphResults(census, container) {
    const { data: responses, error } = await db.from('responses').select('*').eq('census_id', census.id);

    const form = document.createElement('form');
    form.id = 'active-survey-form';

    if (error || !responses || responses.length === 0) {
        form.innerHTML = `
            <div class="surface-card code-card" style="text-align: center;">
                <h2>Census Closed</h2>
                <p style="margin-top: 10px;">No responses were submitted for this census.</p>
                <button type="button" class="btn-pop secondary" style="margin-top: 20px;" onclick="window.location.href='../silly-census/'">Back to Home</button>
            </div>
        `;
        container.appendChild(form);
        return;
    }

    const titleHeader = document.createElement('h2');
    titleHeader.textContent = 'Final Results';
    titleHeader.style.marginBottom = '20px';
    titleHeader.style.textAlign = 'center';
    form.appendChild(titleHeader);

    census.questions.forEach((q, idx) => {
        const qKey = `q_${idx}`;
        
        const qCard = document.createElement('div');
        qCard.className = 'surface-card code-card';
        qCard.style.marginBottom = '20px';
        qCard.innerHTML = `<h3 style="font-size: 1.5rem; margin-bottom: 15px;">${idx + 1}. ${q.text}</h3>`;

        if (q.type === 'text') {
            const listDiv = document.createElement('div');
            listDiv.style.display = 'flex';
            listDiv.style.flexDirection = 'column';
            listDiv.style.gap = '10px';

            let hasAnswers = false;
            responses.forEach(r => {
                const ans = r.answers[qKey];
                if (ans && ans.trim() !== '') {
                    hasAnswers = true;
                    const p = document.createElement('div');
                    p.className = 'code-input'; 
                    p.style.marginTop = '0';
                    p.style.border = '2px solid oklch(0.968 0.008 60 / 40%)';
                    p.style.color = 'var(--muted-foreground)';
                    p.textContent = ans;
                    listDiv.appendChild(p);
                }
            });

            if (!hasAnswers) {
                listDiv.innerHTML = '<p>No written answers.</p>';
            }
            
            qCard.appendChild(listDiv);
            form.appendChild(qCard);
            return;
        }

        const counts = {};
        responses.forEach(r => {
            const ans = r.answers[qKey];
            if (Array.isArray(ans)) {
                ans.forEach(val => { counts[val] = (counts[val] || 0) + 1; });
            }
        });

        const chartWrapper = document.createElement('div');
        chartWrapper.style.position = 'relative';
        chartWrapper.style.height = '180px';
        chartWrapper.style.width = '100%';
        
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${idx}`;
        
        chartWrapper.appendChild(canvas);
        qCard.appendChild(chartWrapper);
        form.appendChild(qCard);

        const labels = Object.keys(counts);
        const dataValues = Object.values(counts);

        if (labels.length === 0) {
            qCard.innerHTML += '<p>No answers recorded for this question.</p>';
            return;
        }

        if (typeof Chart !== 'undefined') {
            new Chart(canvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Votes',
                        data: dataValues,
                        backgroundColor: '#bf0811',
                        borderWidth: 0,
                        borderRadius: 4
                    }]
                },
                plugins: [insideLabelsPlugin],
                options: {
                    events: [],
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { display: false },
                        x: { 
                            beginAtZero: true, 
                            ticks: { stepSize: 1, color: '#ffffff' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                }
            });
        }
    });

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn-pop small';
    backBtn.style.width = '100%';
    backBtn.style.marginTop = '10px';
    backBtn.textContent = 'Back to Home';
    backBtn.onclick = () => window.location.href = 'index.html';
    form.appendChild(backBtn);

    container.appendChild(form);
}