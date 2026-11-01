// Complemento da prévia 2.0: consultas de leitura e navegação das novas áreas.
(() => {
  const URL = "https://bftrtklztznugjdrkdmr.supabase.co";
  const KEY = "sb_publishable_diEWUnv4AjgaNqusy6EY2Q_J-FYZ3aG";
  const db = window.supabase.createClient(URL, KEY);
  const $ = id => document.getElementById(id);
  const brl = n => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
  const date = s => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let customers = [], stock = [], incomes = [], expenses = [];
  const daysFromToday = s => Math.round((new Date(s+"T12:00:00") - new Date(today()+"T12:00:00"))/86400000);
  const statusLabel = c => {
    if (c.due_date < today()) return "Expirado";
    if (String(c.status||"").toLowerCase().includes("pix")) return "Aguardando Pix";
    return c.status || "Ativo";
  };
  function renderAllCustomers() {
    const q = ($("customer-search")?.value || "").trim().toLocaleLowerCase("pt-BR");
    const st = $("status-filter")?.value || "", sv = $("server-filter")?.value || "";
    let rows = customers.filter(c => {
      const status = statusLabel(c);
      const hay = [c.name,c.internal_notes,c.server,c.plan].join(" ").toLocaleLowerCase("pt-BR");
      return (!q || hay.includes(q)) && (!st || status===st) && (!sv || c.server===sv);
    });
    const sort = $("sort-filter")?.value || "name";
    rows.sort((a,b) => sort==="due" ? a.due_date.localeCompare(b.due_date) : sort==="status" ? statusLabel(a).localeCompare(statusLabel(b)) : a.name.localeCompare(b.name,"pt-BR"));
    $("all-customer-rows").innerHTML = rows.map(c => {
      const st=statusLabel(c), cls=st==="Ativo"?"ok":st==="Aguardando Pix"?"warn":"bad";
      return `<tr><td><b>${esc(c.name)}</b><br><small class="muted">${esc(c.server||"")}</small></td><td>${date(c.due_date)}</td><td><span class="status-pill ${cls}">${esc(st)}</span></td><td>${esc(c.internal_notes||"—")}</td><td><button class="action-renew" data-renew="${esc(c.id)}">↻ Renovar</button></td></tr>`;
    }).join("") || '<tr><td colspan="5" class="empty-state">Nenhum cliente encontrado.</td></tr>';
    $("customer-result-count").textContent = `${rows.length} de ${customers.length} clientes`;
    document.querySelectorAll("[data-renew]").forEach(b => b.addEventListener("click", () => {
      const id=b.dataset.renew; const target=document.querySelector('[data-page="operations"]');
      target?.click(); const select=$("renew-customer"); if(select){select.value=id;select.dispatchEvent(new Event("change"));}
    }));
  }
  function renderStock() {
    $("all-stock").innerHTML = stock.map(x => `<article><small>${esc(x.server_name)}</small><strong>${Number(x.available_credits||0)} créditos</strong><span class="muted">Saldo atual</span></article>`).join("") || '<article>Estoque indisponível.</article>';
  }
  function renderCash() {
    const paidIn=incomes.filter(x=>String(x.status||"").toLowerCase().includes("received")||String(x.status||"").toLowerCase().includes("receb")||x.received_at).reduce((s,x)=>s+Number(x.amount||0),0);
    const paidOut=expenses.filter(x=>String(x.status||"").toLowerCase().includes("paid")||String(x.status||"").toLowerCase().includes("pago")||x.paid_at).reduce((s,x)=>s+Number(x.amount||0),0);
    // Indicador de movimentação líquida do período; não representa saldo bancário conciliado.
    $("cash-balance").textContent=brl(paidIn-paidOut); $("cash-income").textContent=brl(paidIn); $("cash-expense").textContent=brl(paidOut);
    const receivable=incomes.filter(x=>!x.received_at && !String(x.status||"").toLowerCase().match(/received|receb/)).reduce((s,x)=>s+Number(x.amount||0),0);
    const payable=expenses.filter(x=>!x.paid_at && !String(x.status||"").toLowerCase().match(/paid|pago/)).reduce((s,x)=>s+Number(x.amount||0),0);
    $("cash-projected").textContent=brl(paidIn-paidOut+receivable-payable);
    document.querySelectorAll(".cash-tab").forEach(b=>b.addEventListener("click",()=>{
      document.querySelectorAll(".cash-tab").forEach(x=>x.classList.toggle("active",x===b));
      const key=b.dataset.cash;
      const data=key==="receitas"?incomes:key==="despesas"?expenses:key==="receber"?incomes.filter(x=>!x.received_at):key==="pagar"?expenses.filter(x=>!x.paid_at):[];
      if(key==="extra") $("cash-content").innerHTML='<p class="muted">Área Renda Extra — Aplicativos preparada na interface. O formulário de lançamento e a conciliação de despesas serão habilitados após definir a conta financeira e as categorias.</p>';
      else if(key==="resumo") $("cash-content").innerHTML='<p class="muted">Resumo de movimentações do mês. Os indicadores acima são calculados a partir dos lançamentos disponíveis; o saldo bancário inicial ainda precisa ser conciliado por conta.</p>';
      else $("cash-content").innerHTML=data.slice(0,40).map(x=>`<div class="row"><span>${esc(x.description)}<br><small class="muted">${date(x.income_date||x.expense_date)} · ${esc(x.status||"")}</small></span><b>${brl(x.amount)}</b></div>`).join("")||'<p class="muted">Nenhum lançamento encontrado.</p>';
    }));
  }
  async function refresh() {
    const session=await db.auth.getSession(); if(!session.data.session) return;
    try {
      const [c,s,i,e]=await Promise.all([
        db.from("customers").select("id,name,server,plan,price,due_date,status,internal_notes").is("archived_at",null).order("name").limit(2000),
        db.from("server_credit_stock").select("server_name,available_credits").order("server_name"),
        db.from("incomes").select("id,description,amount,income_date,status,received_at,visibility,source").is("archived_at",null).order("income_date",{ascending:false}).limit(500),
        db.from("expenses").select("id,description,amount,expense_date,status,paid_at,visibility,category").is("archived_at",null).order("expense_date",{ascending:false}).limit(500)
      ]);
      if(c.error) throw c.error; customers=c.data||[]; stock=s.data||[]; incomes=i.data||[]; expenses=e.data||[];
      const active=customers.filter(x=>x.due_date>=today() && ["Ativo","Aguardando Pix"].includes(statusLabel(x))).length;
      const expired=customers.filter(x=>x.due_date<today()).length;
      const soon=customers.filter(x=>x.due_date>=today() && daysFromToday(x.due_date)<=3 && ["Ativo","Aguardando Pix"].includes(statusLabel(x))).length;
      if($("active-count")) $("active-count").textContent=active;
      if($("expired-count")) $("expired-count").textContent=expired;
      if($("total-count")) $("total-count").textContent=customers.length;
      if($("soon-count")) $("soon-count").textContent=soon;
      renderAllCustomers(); renderStock(); renderCash();
    } catch(err) { if($("notice")){ $("notice").textContent="Alguns dados da prévia não puderam ser carregados: "+(err.message||err); $("notice").classList.remove("hide"); } }
  }
  ["customer-search","status-filter","server-filter","sort-filter"].forEach(id=>$(id)?.addEventListener("input",renderAllCustomers));
  $("report-apply")?.addEventListener("click",()=>{
    const category=$("report-category").value, from=$("report-from").value, to=$("report-to").value;
    const labels={customers:`${customers.length} clientes cadastrados`,finance:`${incomes.length} receitas e ${expenses.length} despesas consultáveis`,credits:`${stock.length} servidores com saldo consultável`,extra:"Os lançamentos de Renda Extra ainda não estão habilitados",activity:"Atividades disponíveis serão consolidadas na próxima etapa",all:`${customers.length} clientes · ${incomes.length} receitas · ${expenses.length} despesas`};
    $("report-output").innerHTML=`<div class="calc">Período: ${date(from)} até ${date(to)}<br>${labels[category]||labels.all}</div><p class="muted">Prévia de relatório. Os filtros de data serão aplicados aos relatórios detalhados na etapa de consolidação.</p>`;
  });
  const now=today(); if($("report-to")) $("report-to").value=now; if($("report-from")){const d=new Date();d.setDate(1);$("report-from").value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),"01"].join("-");}
  document.querySelectorAll('[data-page="all-customers"],[data-page="cashbook"],[data-page="reports"]').forEach(b=>b.addEventListener("click",()=>setTimeout(refresh,150)));
  db.auth.onAuthStateChange((event,session)=>{if(session) setTimeout(refresh,200)});
})();
