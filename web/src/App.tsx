import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, LayoutDashboard, LogOut, Menu, Plus, Scissors, Sparkles, Users, X } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "https://bookease.hrms.ssym.co.in";
type User = { id:string;name:string;email:string;role:"owner"|"customer" };
type Booking = { id:string;starts_at:string;ends_at:string;status:string;service_name:string;customer_name:string;customer_email:string;color:string;price:number };
type Service = { id:string;name:string;description:string;duration_minutes:number;price:number;color:string };
type Metrics = { today_bookings:number;week_bookings:number;month_revenue:number;total_customers:number };

async function request(path:string, token?:string, options:RequestInit={}) {
  const response=await fetch(`${API}${path}`,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...options.headers}});
  const data=await response.json(); if(!response.ok) throw new Error(data.message||"Request failed"); return data;
}

export default function App(){
  const [token,setToken]=useState(()=>localStorage.getItem("bookease-token")||"");
  const [user,setUser]=useState<User|null>(()=>JSON.parse(localStorage.getItem("bookease-user")||"null"));
  const [email,setEmail]=useState("owner@bookease.demo"); const [password,setPassword]=useState("Demo@123");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false); const [menu,setMenu]=useState(false);
  const [bookings,setBookings]=useState<Booking[]>([]); const [services,setServices]=useState<Service[]>([]);
  const [metrics,setMetrics]=useState<Metrics>({today_bookings:0,week_bookings:0,month_revenue:0,total_customers:0});
  const [dialog,setDialog]=useState<"booking"|"details"|null>(null); const [selected,setSelected]=useState<Booking|null>(null);
  const [serviceId,setServiceId]=useState(""); const [startsAt,setStartsAt]=useState(""); const [notes,setNotes]=useState("");

  async function refresh(){const [b,s,m]=await Promise.all([request("/api/bookings",token),request("/api/services"),request("/api/dashboard",token)]);setBookings(b);setServices(s);setMetrics(m);if(!serviceId&&s[0])setServiceId(s[0].id)}
  useEffect(()=>{ if(!token)return; refresh().catch((e)=>setError(e.message)); },[token]);
  async function login(e:React.FormEvent){ e.preventDefault();setLoading(true);setError("");try{const data=await request("/api/auth/login",undefined,{method:"POST",body:JSON.stringify({email,password})});localStorage.setItem("bookease-token",data.token);localStorage.setItem("bookease-user",JSON.stringify(data.user));setToken(data.token);setUser(data.user)}catch(e){setError((e as Error).message)}finally{setLoading(false)} }
  function logout(){localStorage.removeItem("bookease-token");localStorage.removeItem("bookease-user");setToken("");setUser(null)}
  async function createBooking(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");try{await request("/api/bookings",token,{method:"POST",body:JSON.stringify({serviceId,startsAt:new Date(startsAt).toISOString(),notes})});await refresh();setDialog(null);setNotes("");setStartsAt("")}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  async function updateStatus(status:"confirmed"|"completed"|"cancelled"){if(!selected)return;setLoading(true);setError("");try{await request(`/api/bookings/${selected.id}/status`,token,{method:"PATCH",body:JSON.stringify({status})});await refresh();setDialog(null);setSelected(null)}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  function openDetails(booking:Booking){setSelected(booking);setDialog("details")}
  function closeMenu(){setMenu(false)}
  const nextBooking=useMemo(()=>bookings.find((b)=>new Date(b.starts_at)>new Date()&&b.status!=="cancelled"),[bookings]);
  if(!token||!user) return <Login email={email} password={password} setEmail={setEmail} setPassword={setPassword} submit={login} error={error} loading={loading}/>;

  return <div className="app-shell">
    <aside className={menu?"sidebar open":"sidebar"}>
      <div className="logo"><span><CalendarDays size={20}/></span>BookEase</div><button className="close" onClick={()=>setMenu(false)}><X/></button>
      <nav><a className="active" href="#overview" onClick={closeMenu}><LayoutDashboard/>Overview</a><a href="#bookings" onClick={closeMenu}><CalendarDays/>Bookings <span>{metrics.today_bookings}</span></a><a href="#services" onClick={closeMenu}><Scissors/>Services</a><a href="#customers" onClick={closeMenu}><Users/>Customers</a></nav>
      <div className="side-note"><Sparkles/><strong>Booking tip</strong><p>Keep 15-minute buffers between long sessions.</p></div>
      <button className="logout" onClick={logout}><LogOut/>Log out</button>
    </aside>
    <main className="content">
      <header><button className="mobile-menu" onClick={()=>setMenu(true)}><Menu/></button><div><p>Tuesday, 30 September</p><h1>Good morning, {user.name.split(" ")[0]}</h1></div><div className="avatar">{user.name.split(" ").map(v=>v[0]).slice(0,2).join("")}</div></header>
      {error&&<div className="error">{error}</div>}
      <section className="hero-card" id="overview"><div><span>BUSINESS OVERVIEW</span><h2>A calm day,<br/>beautifully organised.</h2><p>Your schedule, customers, and services in one focused workspace.</p><button onClick={()=>setDialog("booking")}><Plus/>Create booking</button></div><div className="next-card"><small>NEXT APPOINTMENT</small>{nextBooking?<><div className="time">{new Date(nextBooking.starts_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</div><strong>{nextBooking.service_name}</strong><p>{nextBooking.customer_name}</p><span><Clock3/> {Math.round((new Date(nextBooking.ends_at).getTime()-new Date(nextBooking.starts_at).getTime())/60000)} minutes</span></>:<p>No upcoming bookings.</p>}</div></section>
      <section className="stats" id="customers">
        <article><span>Today&apos;s bookings</span><strong>{metrics.today_bookings}</strong><i>Confirmed schedule</i></article>
        <article><span>This week</span><strong>{metrics.week_bookings}</strong><i>Across all services</i></article>
        <article><span>Monthly revenue</span><strong>₹{metrics.month_revenue.toLocaleString("en-IN")}</strong><i>Completed bookings</i></article>
        <article><span>Total customers</span><strong>{metrics.total_customers}</strong><i>Growing steadily</i></article>
      </section>
      <div className="grid-two">
        <section className="panel" id="bookings"><div className="panel-head"><div><span>SCHEDULE</span><h3>Appointment schedule</h3></div><button onClick={()=>setDialog("booking")}>Add booking <ArrowUpRight/></button></div>
          <div className="booking-list">{bookings.slice(0,8).map((b)=><button className="booking" key={b.id} onClick={()=>openDetails(b)}><i style={{background:b.color}}/><time>{new Date(b.starts_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</time><div><strong>{b.customer_name}</strong><span>{b.service_name}</span></div><em className={b.status}>{b.status}</em><ChevronRight/></button>)}</div>
        </section>
        <section className="panel" id="services"><div className="panel-head"><div><span>CATALOGUE</span><h3>Popular services</h3></div></div>
          <div className="service-list">{services.map((s)=><div key={s.id}><i style={{background:s.color}}><Check/></i><div><strong>{s.name}</strong><span>{s.duration_minutes} min · ₹{s.price}</span></div></div>)}</div>
        </section>
      </div>
    </main>
    {dialog&&<div className="modal-backdrop" onMouseDown={()=>setDialog(null)}><section className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setDialog(null)} aria-label="Close"><X/></button>{dialog==="booking"?<form onSubmit={createBooking}><p>NEW APPOINTMENT</p><h2>Create booking</h2><label>Service<select value={serviceId} onChange={e=>setServiceId(e.target.value)} required>{services.map(s=><option value={s.id} key={s.id}>{s.name} · ₹{s.price}</option>)}</select></label><label>Date and time<input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} required/></label><label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={500} placeholder="Optional details"/></label><button className="modal-primary" disabled={loading}>{loading?"Saving…":"Create booking"}</button></form>:selected&&<div><p>BOOKING DETAILS</p><h2>{selected.service_name}</h2><div className="detail-lines"><span><b>Customer</b>{selected.customer_name}</span><span><b>Time</b>{new Date(selected.starts_at).toLocaleString("en-IN")}</span><span><b>Status</b>{selected.status}</span></div><div className="status-actions"><button onClick={()=>updateStatus("confirmed")}>Confirm</button><button onClick={()=>updateStatus("completed")}>Complete</button><button className="danger" onClick={()=>updateStatus("cancelled")}>Cancel</button></div></div>}</section></div>}
  </div>
}

function Login({email,password,setEmail,setPassword,submit,error,loading}:{email:string;password:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;submit:(e:React.FormEvent)=>void;error:string;loading:boolean}){
  return <main className="login-page"><section className="login-story"><div className="logo light"><span><CalendarDays size={20}/></span>BookEase</div><div><p>SMART SCHEDULING FOR SMALL TEAMS</p><h1>More time for the work<br/><em>you do best.</em></h1><span>Appointments, services, and customer details without the daily admin noise.</span></div><footer>Portfolio project · Naman Choudhary</footer></section><section className="login-form"><form onSubmit={submit}><span className="mobile-logo">BookEase</span><p>WELCOME BACK</p><h2>Sign in to your workspace</h2><label>Email address<input value={email} onChange={(e)=>setEmail(e.target.value)} type="email"/></label><label>Password<input value={password} onChange={(e)=>setPassword(e.target.value)} type="password"/></label>{error&&<div className="error">{error}</div>}<button className="submit" disabled={loading}>{loading?"Signing in…":"Sign in"}<ArrowUpRight/></button><div className="demo"><strong>Demo account</strong><span>owner@bookease.demo / Demo@123</span></div></form></section></main>
}
