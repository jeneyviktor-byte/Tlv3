/* ING Mortgage – Life Protection (EN/DE)
   - Headline & style aligned to ING
   - New/renamed questions + defaults
   - BMI (gender-agnostic) + rule: BMI < 35 ⇒ "Refer to Underwriter"
*/
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const view = $("#view");
const prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn");
const saveBtn = $("#saveBtn"), loadBtn = $("#loadBtn");
const downloadBtn = $("#downloadBtn"), resetBtn = $("#resetBtn");
const langSelect = $("#langSelect"); const progressBar = $("#progressBar");

/* i18n */
const t = {
  en: {
    steps:["Intro","Quick Quote","Sign Up & Verify","Health","Pay & Bind","Done"],
    next:"Next", prev:"Back", save:"Save", load:"Load", download:"Download JSON", reset:"Reset",
    intro_title:"From first contact to policy delivery",
    intro_sub:"Fast, bilingual journey. Your answers shape the questions.",
    quick_title:"Quick Quote", quick_help:"Please confirm a few details to estimate your price.",
    dob:"Confirm your date of birth", postal:"Confirm your postal code",
    coverage:"Amount of protection (€)", term:"Protection duration (years)", smoker:"Smoker?",
    sport:"I’m doing sport minimum… (times per week)", sport_ph:"Select a frequency per week (0–7)",
    weigh:"I weigh… (kg)", weigh_ph:"Type in a value (40–250)",
    height:"My height is… (cm)", height_ph:"Type in a value (90–250)",
    est_premium:"Estimated Premium", per_month:"per month", disclaimer:"Non-binding estimate; final price depends on underwriting.",
    signup_title:"Create Account & Verify Identity", email:"Email", phone:"Phone",
    verify:"Verification method", verify_eid:"eID (preferred)", verify_video:"Video-ID",
    health_title:"Health Questions", conditions:"Medical conditions",
    claims:"Previous serious claims", occupation:"Occupation",
    pay_title:"Pay & Bind", pay_sub:"Add payment to bind your policy. (Mock)",
    pay_method:"Payment method", pay_iban:"SEPA IBAN", pay_card:"Card (test)",
    review:"Review", bind:"Bind Policy", success_title:"Policy issued!",
    success_body:"Your policy (mock) is stored locally.", resume:"We auto-save as you go. Use Load to resume later."
  },
  de: {
    steps:["Intro","Sofortangebot","Registrieren & Identität","Gesundheit","Zahlen & Binden","Fertig"],
    next:"Weiter", prev:"Zurück", save:"Speichern", load:"Laden", download:"JSON exportieren", reset:"Zurücksetzen",
    intro_title:"Von der ersten Anfrage bis zur Policenstellung",
    intro_sub:"Schnelle, zweisprachige Journey. Ihre Antworten steuern die Fragen.",
    quick_title:"Sofortangebot", quick_help:"Bitte einige Angaben bestätigen für die Preisschätzung.",
    dob:"Bestätigen Sie Ihr Geburtsdatum", postal:"Bestätigen Sie Ihre Postleitzahl",
    coverage:"Absicherungssumme (€)", term:"Absicherungsdauer (Jahre)", smoker:"Raucher?",
    sport:"Ich mache mindestens … Sport (pro Woche)", sport_ph:"Häufigkeit wählen (0–7)",
    weigh:"Ich wiege … (kg)", weigh_ph:"Wert eingeben (40–250)",
    height:"Meine Größe ist … (cm)", height_ph:"Wert eingeben (90–250)",
    est_premium:"Geschätzte Prämie", per_month:"pro Monat", disclaimer:"Unverbindliche Schätzung; endgültiger Preis nach Underwriting.",
    signup_title:"Konto anlegen & Identität prüfen", email:"E-Mail", phone:"Telefon",
    verify:"Verifizierungsmethode", verify_eid:"eID (bevorzugt)", verify_video:"Video-ID",
    health_title:"Gesundheitsfragen", conditions:"Krankheiten",
    claims:"Vorherige schwere Schäden", occupation:"Beruf",
    pay_title:"Bezahlen & Binden", pay_sub:"Zahlungsdaten hinzufügen, um die Police zu binden. (Mock)",
    pay_method:"Zahlungsart", pay_iban:"SEPA-IBAN", pay_card:"Karte (Test)",
    review:"Prüfen", bind:"Police binden", success_title:"Police ausgestellt!",
    success_body:"Ihre Policen-Daten (Mock) werden lokal gespeichert.", resume:"Wir speichern automatisch. Über „Laden“ später fortfahren."
  }
};

/* State (updated defaults) */
const state = JSON.parse(localStorage.getItem("qb_state_v2") || "{}");
state.lang = state.lang || "en";
state.step = state.step || 0;
state.form = Object.assign({
  dob:"1980-06-11",     // 11.06.1980
  postal:"8002",
  coverage:100000,
  term:20,
  smoker:"no",
  sport:"",             // 0–7 times/week
  weigh:"",             // 40–250 kg
  height_cm:"",         // 90–250 cm
  email:"", phone:"", verify:"eid",
  conditions:"none", height:180, weight:75, claims:"no", occupation:"Engineer",
  pay_method:"iban", iban:"DE88 3704 0044 0532 0130 00", card:"4242 4242 4242 4242"
}, state.form || {});

function steps(){ return t[state.lang].steps; }
function save(){ localStorage.setItem("qb_state_v2", JSON.stringify(state)); }
function money(x){ return new Intl.NumberFormat(undefined,{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(x); }
function setProgress(){ progressBar.style.width = (state.step)/(steps().length-1)*100 + "%"; }

/* Helpers */
function ageFromDob(dob){
  if(!dob) return 35;
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear()-d.getFullYear();
  const m = n.getMonth()-d.getMonth();
  if(m<0 || (m===0 && n.getDate()<d.getDate())) a--;
  return Math.max(18, Math.min(70, a));
}

/* pricing: simple illustrative model */
function calcPremium(){
  const {dob, coverage, term, smoker, sport} = state.form;
  const age = ageFromDob(dob);
  let base = age<30?8: age<40?12: age<50?20: age<60?35: 60;
  let p = base * (term/20) * (coverage/100000);
  if(smoker==="yes") p *= 1.45;
  const s = Number(sport);
  if(Number.isFinite(s)) p *= (1 + Math.max(0, 0.01*(7-s))); // add cost if low sport frequency
  return Math.max(5, Math.round(p));
}

/* BMI (gender-agnostic) using height_cm/weigh; fallback to legacy height/weight */
function computeBMI(){
  const w = Number(state.form.weigh || state.form.weight);
  const hcm = Number(state.form.height_cm || state.form.height);
  if(!Number.isFinite(w) || !Number.isFinite(hcm) || hcm<=0) return null;
  const m = hcm/100;
  return Math.round((w/(m*m))*10)/10;
}

/* UW outcome: if BMI < 35 ⇒ Refer to Underwriter, else Immediate Approval */
function uwOutcome(){
  const bmi = computeBMI();
  let outcome = "Immediate Approval";
  if(bmi !== null && bmi < 35) outcome = "Refer to Underwriter";
  return { bmi, outcome };
}

/* Render view */
function render(){
  document.documentElement.lang = state.lang;
  langSelect.value = state.lang;
  prevBtn.textContent = t[state.lang].prev;
  nextBtn.textContent = state.step === steps().length-1 ? "🔁" : t[state.lang].next;
  saveBtn.textContent = t[state.lang].save;
  loadBtn.textContent = t[state.lang].load;
  downloadBtn.textContent = t[state.lang].download;
  resetBtn.textContent = t[state.lang].reset;
  setProgress();

  const s = state.step;
  view.innerHTML = "";

  if(s===0){
    const el = document.createElement("section");
    el.className="card";
    el.innerHTML = `
      <h1>${t[state.lang].intro_title}</h1>
      <p class="help">${t[state.lang].intro_sub}</p>
      <div class="kpi">
        <span class="pill">ING Look &amp; Feel</span>
        <span class="pill">EN / DE</span>
        <span class="pill">Save &amp; Resume</span>
      </div>
      <hr/>
      <p class="help">${t[state.lang].resume}</p>`;
    view.appendChild(el);
  }

  if(s===1){
    const el = document.createElement("section");
    el.className="card grid cols-2";
    el.innerHTML = `
      <div>
        <h1>${t[state.lang].quick_title}</h1>
        <p class="help">${t[state.lang].quick_help}</p>

        <label>${t[state.lang].dob}</label>
        <input type="date" id="dob" value="${state.form.dob || "1980-06-11"}" />

        <label>${t[state.lang].postal}</label>
        <input type="number" id="postal" min="1000" max="9999" step="1" value="${state.form.postal || "8002"}" />

        <div class="input-inline">
          <div>
            <label>${t[state.lang].coverage}</label>
            <input type="number" id="coverage" min="10000" step="10000" value="${state.form.coverage}" />
          </div>
          <div>
            <label>${t[state.lang].term}</label>
            <select id="term">
              ${[5,10,15,20,25,30].map(y=>`<option ${state.form.term==y?'selected':''}>${y}</option>`).join("")}
            </select>
          </div>
        </div>

        <label>${t[state.lang].smoker}</label>
        <select id="smoker">
          <option value="no" ${state.form.smoker==="no"?"selected":""}>No / Nein</option>
          <option value="yes" ${state.form.smoker==="yes"?"selected":""}>Yes / Ja</option>
        </select>

        <label>${t[state.lang].sport}</label>
        <input type="number" id="sport" min="0" max="7" step="1" placeholder="${t[state.lang].sport_ph}" value="${state.form.sport || ""}" />

        <div class="input-inline">
          <div>
            <label>${t[state.lang].weigh}</label>
            <input type="number" id="weigh" min="40" max="250" step="1" placeholder="${t[state.lang].weigh_ph}" value="${state.form.weigh || ""}" />
          </div>
          <div>
            <label>${t[state.lang].height}</label>
            <input type="number" id="height_cm" min="90" max="250" step="1" placeholder="${t[state.lang].height_ph}" value="${state.form.height_cm || ""}" />
          </div>
        </div>

        <p class="help">${t[state.lang].disclaimer}</p>
      </div>

      <div>
        <div class="alert">
          <div class="row">
            <strong>${t[state.lang].est_premium}</strong>
            <span class="tag">Rule-based mock</span>
          </div>
          <div style="font-size:2.2rem;margin-top:4px" class="money" id="estPrem">—</div>
          <div class="help">€ / ${t[state.lang].per_month}</div>
          <hr/>
          <div id="uwBox" class="help"></div>
        </div>
      </div>`;
    view.appendChild(el);

    const recalc = ()=>{
      state.form.dob = $("#dob").value;
      state.form.postal = $("#postal").value.trim();
      state.form.coverage = +$("#coverage").value;
      state.form.term = +$("#term").value;
      state.form.smoker = $("#smoker").value;
      state.form.sport = $("#sport").value;
      state.form.weigh = $("#weigh").value;
      state.form.height_cm = $("#height_cm").value;
      save();
      $("#estPrem").textContent = money(calcPremium());
      const {bmi, outcome} = uwOutcome();
      $("#uwBox").innerHTML = (bmi===null)
        ? `BMI: <em>provide height & weight</em> • Outcome: <strong>${outcome}</strong>`
        : `BMI: <strong>${bmi}</strong> • Outcome: <strong>${outcome}</strong>`;
    };
    ["dob","postal","coverage","term","smoker","sport","weigh","height_cm"]
      .forEach(id=>$("#"+id).addEventListener("input", recalc));
    recalc();
  }

  if(s===2){
    const el = document.createElement("section");
    el.className="card grid cols-2";
    el.innerHTML = `
      <div>
        <h1>${t[state.lang].signup_title}</h1>
        <label>${t[state.lang].email}</label>
        <input type="email" id="email" value="${state.form.email}" placeholder="name@example.com" />
        <label>${t[state.lang].phone}</label>
        <input type="tel" id="phone" value="${state.form.phone}" placeholder="+49 170 000000" />
      </div>
      <div>
        <label>${t[state.lang].verify}</label>
        <select id="verify">
          <option value="eid" ${state.form.verify==="eid"?"selected":""}>${t[state.lang].verify_eid}</option>
          <option value="video" ${state.form.verify==="video"?"selected":""}>${t[state.lang].verify_video}</option>
        </select>
        <div class="alert help">This is a mock. No data is transmitted.</div>
      </div>`;
    view.appendChild(el);
    ["email","phone","verify"].forEach(id=>$("#"+id).addEventListener("input",
      e=>{ state.form[id]=e.target.value; save(); }));
  }

  if(s===3){
    const el = document.createElement("section");
    el.className="card grid cols-2";
    el.innerHTML = `
      <div>
        <h1>${t[state.lang].health_title}</h1>
        <label>${t[state.lang].conditions}</label>
        <input id="conditions" value="${state.form.conditions}" />

        <div class="input-inline">
          <div><label>Height (cm)</label><input type="number" id="height" value="${state.form.height}" /></div>
          <div><label>Weight (kg)</label><input type="number" id="weight" value="${state.form.weight}" /></div>
        </div>

        <label>${t[state.lang].claims}</label>
        <select id="claims">
          <option value="no" ${state.form.claims==="no"?"selected":""}>No / Nein</option>
          <option value="yes" ${state.form.claims==="yes"?"selected":""}>Yes / Ja</option>
        </select>

        <label>${t[state.lang].occupation}</label>
        <input id="occupation" value="${state.form.occupation}" />
      </div>
      <div class="alert"><div id="uwBox2"></div></div>`;
    view.appendChild(el);

    const onInput=(id)=> e=>{
      const v = (id==="height"||id==="weight") ? +e.target.value : e.target.value;
      state.form[id] = v;
      if(id==="height") state.form.height_cm = v;
      if(id==="weight") state.form.weigh = v;
      save(); refreshUW();
    };
    ["conditions","height","weight","claims","occupation"]
      .forEach(id=>$("#"+id).addEventListener("input", onInput(id)));

    function refreshUW(){
      const {bmi, outcome} = uwOutcome();
      $("#uwBox2").innerHTML = (bmi===null)
        ? `<strong>Underwriting:</strong> BMI — • ${outcome}<br/><span class="help">Demo rule only.</span>`
        : `<strong>Underwriting:</strong> BMI ${bmi} • ${outcome}<br/><span class="help">Demo rule only.</span>`;
    }
    refreshUW();
  }

  if(s===4){
    const el = document.createElement("section");
    el.className="card grid cols-2";
    el.innerHTML = `
      <div>
        <h1>${t[state.lang].pay_title}</h1>
        <p class="help">${t[state.lang].pay_sub}</p>
        <label>${t[state.lang].pay_method}</label>
        <select id="pay_method">
          <option value="iban" ${state.form.pay_method==="iban"?"selected":""}>${t[state.lang].pay_iban}</option>
          <option value="card" ${state.form.pay_method==="card"?"selected":""}>${t[state.lang].pay_card}</option>
        </select>
        <div id="payFields"></div>
      </div>
      <div>
        <div class="alert">
          <div class="row"><strong>${t[state.lang].review}</strong><span class="tag">Mock</span></div>
          <hr/>
          <div id="reviewBox"></div>
          <hr/>
          <button id="bindBtn" class="btn btn-primary">${t[state.lang].bind}</button>
          <div id="bindMsg" class="help"></div>
        </div>
      </div>`;
    view.appendChild(el);

    const drawFields = () => {
      const pf = $("#payFields");
      pf.innerHTML = state.form.pay_method === "iban"
        ? `<label>${t[state.lang].pay_iban}</label><input id="iban" value="${state.form.iban}" />`
        : `<label>${t[state.lang].pay_card}</label><input id="card" value="${state.form.card}" />`;
      const fld = state.form.pay_method === "iban" ? "iban" : "card";
      $("#" + fld).addEventListener("input", e => { state.form[fld] = e.target.value; save(); });
    };
    $("#pay_method").addEventListener("input", e => { state.form.pay_method = e.target.value; save(); drawFields(); });
    drawFields();

    const review = () => {
      $("#reviewBox").innerHTML = `
        Postal: <strong>${state.form.postal || "-"}</strong><br/>
        Coverage: <strong class="money">€${(+state.form.coverage).toLocaleString()}</strong><br/>
        Duration: <strong>${state.form.term}y</strong> • Smoker: <strong>${state.form.smoker}</strong><br/>
        Est. Premium: <strong class="money">${money(calcPremium())}/mo</strong>`;
    };
    review();

    $("#bindBtn").addEventListener("click", () => {
      $("#bindBtn").disabled = true;
      setTimeout(() => {
        const policy = {
          id: "DE-" + Math.random().toString(36).slice(2,8).toUpperCase(),
          issuedAt: new Date().toISOString(),
          premium: calcPremium(),
          ...state.form
        };
        localStorage.setItem("qb_policy", JSON.stringify(policy));
        $("#bindMsg").innerHTML = `<span class="tag">OK</span> Policy ${policy.id} issued (mock). See localStorage.`;
        state.step = 5; save(); render();
      }, 600);
    });
  }

  if(s===5){
    const pol = JSON.parse(localStorage.getItem("qb_policy") || "null");
    const el = document.createElement("section");
    el.className="card";
    el.innerHTML = `
      <h1>✅ ${t[state.lang].success_title}</h1>
      <p>${t[state.lang].success_body}</p>
      <div class="alert"><code>${pol ? JSON.stringify(pol,null,2) : "No policy"}</code></div>
      <button class="btn btn-secondary" id="startOver">Start Over</button>`;
    view.appendChild(el);
    $("#startOver").addEventListener("click", () => { state.step = 0; save(); render(); });
  }

  prevBtn.disabled = s === 0;
  nextBtn.disabled = s === 5;
}
render();

/* Controls */
prevBtn.addEventListener("click", () => { if(state.step>0){ state.step--; save(); render(); } });
nextBtn.addEventListener("click", () => { if(state.step<steps().length-1){ state.step++; save(); render(); } });
saveBtn.addEventListener("click", () => { save(); alert("Saved locally."); });
loadBtn.addEventListener("click", () => { const s = JSON.parse(localStorage.getItem("qb_state_v2")||"null"); if(s){ Object.assign(state,s); render(); } else alert("Nothing saved yet."); });
downloadBtn.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="qb_state.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); });
resetBtn.addEventListener("click", () => { if(confirm("Clear data and restart?")){ localStorage.removeItem("qb_state_v2"); localStorage.removeItem("qb_policy"); location.reload(); } });
langSelect.addEventListener("input", e => { state.lang = e.target.value; save(); render(); });

/* Hash router sync */
window.addEventListener("hashchange", () => { const s = parseInt(location.hash.replace("#",""), 10); if(!isNaN(s)){ state.step=Math.max(0,Math.min(5,s)); save(); render(); } });
setInterval(() => { if(parseInt(location.hash.replace("#",""), 10) !== state.step){ location.hash = String(state.step); } }, 300);