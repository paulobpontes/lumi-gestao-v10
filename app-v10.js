// Primeira etapa: login e leitura. Nenhuma operação de escrita é executada.
(() => {
 const URL="https://bftrtklztznugjdrkdmr.supabase.co";
 const KEY="sb_publishable_diEWUnv4AjgaNqusy6EY2Q_J-FYZ3aG";
 const db=window.supabase.createClient(URL,KEY), $=id=>document.getElementById(id);
 const brl=n=>Number(n||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const date=s=>s?new Date(s+"T12:00:00").toLocaleDateString("pt-BR"):"—";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 let incomes=[],expenses=[],customers=[],stock=[];
 function notice(s){$("notice").textContent=s;$("notice").classList.remove("hide")}
 function range(){let n=new Date(),a=new Date(n.getFullYear(),n.getMonth(),1),b=new Date(n.getFullYear(),n.getMonth()+1,1);return[a.toISOString().slice(0,10),b.toISOString().slice(0,10)]}
 async function enter(user){
  const p=await db.from("profiles").select("full_name,role").eq("user_id",user.id).maybeSingle();
  if(p.error)throw p.error;if(!p.data)throw Error("Seu usuário não possui perfil cadastrado. O acesso não foi liberado.");
  if(p.data.role!=="admin")throw Error("Este usuário não possui permissão de administrador.");
  $("admin-name").textContent=p.data.full_name||"Administrador";
  $("login").classList.add("hide");$("app").classList.remove("hide");
  await load();
 }
 async function load(){
  let [a,b]=range();$("month").textContent=new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const q=await Promise.all([
   db.from("incomes").select("id,description,amount,income_date,status").gte("income_date",a).lt("income_date",b).is("archived_at",null).order("income_date",{ascending:false}).limit(100),
   db.from("expenses").select("id,description,amount,expense_date,status").gte("expense_date",a).lt("expense_date",b).is("archived_at",null).order("expense_date",{ascending:false}).limit(100),
   db.from("customers").select("id,name,server,plan,price,due_date,status").is("archived_at",null).order("name").limit(1000),
   db.from("server_credit_stock").select("server_name,available_credits").order("server_name")
  ]);
  ["receitas","despesas","clientes","estoque"].forEach((n,i)=>{if(q[i].error)throw Error("Erro ao carregar "+n+": "+q[i].error.message)});
  incomes=q[0].data||[];expenses=q[1].data||[];customers=q[2].data||[];stock=q[3].data||[];
  let i=incomes.reduce((s,x)=>s+Number(x.amount||0),0),e=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  $("income").textContent=brl(i);$("expenses").textContent=brl(e);$("balance").textContent=brl(i-e);$("customers-count").textContent=customers.length;
  $("stock").innerHTML=stock.map(x=>`<div class="row"><span>${esc(x.server_name)}</span><b>${Number(x.available_credits||0)} créditos</b></div>`).join("")||"Sem dados de estoque.";
  let act=[...incomes.map(x=>({...x,t:"Receita",d:x.income_date})),...expenses.map(x=>({...x,t:"Despesa",d:x.expense_date}))].sort((x,y)=>String(y.d).localeCompare(String(x.d))).slice(0,7);
  $("recent").innerHTML=act.map(x=>`<div class="row"><span>${esc(x.description)}<br><small class="muted">${x.t} · ${date(x.d)}</small></span><b>${brl(x.amount)}</b></div>`).join("")||"Sem movimentações no mês.";
  $("customer-rows").innerHTML=customers.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.server)}</td><td>${esc(c.plan)}</td><td>${brl(c.price)}</td><td>${date(c.due_date)}</td><td>${esc(c.status)}</td></tr>`).join("")||'<tr><td colspan="6">Nenhum cliente encontrado.</td></tr>';
  const rows=(arr,d)=>arr.slice(0,15).map(x=>`<div class="row"><span>${esc(x.description)}<br><small class="muted">${date(x[d])}</small></span><b>${brl(x.amount)}</b></div>`).join("")||'<p class="muted">Nenhum registro no mês.</p>';
  $("income-rows").innerHTML=rows(incomes,"income_date");$("expense-rows").innerHTML=rows(expenses,"expense_date");
  $("credit-cards").innerHTML=stock.map(x=>`<article><small>${esc(x.server_name)}</small><strong>${Number(x.available_credits||0)} créditos</strong></article>`).join("");
 }
 $("login-form").addEventListener("submit",async ev=>{ev.preventDefault();$("login-msg").textContent="Verificando acesso...";let r=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(r.error){$("login-msg").textContent="Falha no login: "+r.error.message;return}try{await enter(r.data.user)}catch(err){await db.auth.signOut();$("login-msg").textContent=err.message}});
 $("logout").addEventListener("click",async()=>{await db.auth.signOut();$("app").classList.add("hide");$("login").classList.remove("hide")});
 const names={dashboard:"Visão geral",customers:"Clientes",finance:"Financeiro",credits:"Créditos"};
 document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".page").forEach(p=>p.classList.add("hide"));$("page-"+b.dataset.page).classList.remove("hide");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n===b));$("title").textContent=names[b.dataset.page]}));
 db.auth.getSession().then(async r=>{if(r.data.session)try{await enter(r.data.session.user)}catch(e){await db.auth.signOut();$("login-msg").textContent=e.message}});
})();