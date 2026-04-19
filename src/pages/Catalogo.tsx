import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://iblufmwrggywzosuobpk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlibHVmbXdyZ2d5d3pvc3VvYnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTE2MTEsImV4cCI6MjA4OTEyNzYxMX0.PcJSENVSePE3gfIGDmJguc2VPAHyzQPAfVgtC0Bk_oA"
);

const LOGO_URL = "https://res.cloudinary.com/dpfk35vqc/image/upload/v1775250448/IMG_6554_klsr9i.png";
const WHATSAPP_NUMBER = "584141291930";

const DELIVERY_ZONES = [
  { id: "th",     name: "Terrazas Amarillas / Azules / Verdes",                   fee: 0.40 },
  { id: "otros",  name: "Laguna · Arado · Tejados · Casablanca · Terrazas Edif", fee: 0.80 },
  { id: "zafra",  name: "La Zafra · Panelas · Otros sectores",                   fee: 1.00 },
  { id: "retiro", name: "Sin delivery — Retiro directo",                          fee: 0.00 },
];

const PRESETS_KG    = [0.2, 0.25, 0.5, 1, 1.5];
const PRESETS_UNIT  = [1, 2, 3, 4, 5, 6];
const PRESETS_EGGS  = [0.5, 1, 2, 3, 4];
const LABEL_KG      = ["200g","250g","500g","1kg","1.5kg"];
const LABEL_UNIT    = ["1","2","3","4","5","6"];
const LABEL_EGGS    = ["½","1","2","3","4"];

const isEgg    = (nombre: string) => nombre.toLowerCase().includes("huevo");
const isKgUnit = (unidad: string | null) => (unidad || "").toLowerCase() === "kg";
const CAT_ORDER = ["charcutería", "chucherías", "bebidas", "víveres", "aseo", "licores"];

type Variante = { id: string; nombre: string; precio_venta_usd: number | null; stock_actual: number | null };
type CatPrincipal = { id: string; nombre: string };
type Producto  = {
  id: string; nombre: string; categoria_id: string | null; unidad: string | null;
  subcategoria_nombre: string | null;
  imagen_url: string | null; precio_venta_usd: number | null; stock_actual: number | null;
  variaciones: Variante[];
};
type CartItem = {
  key: string; nombre: string; variante: string | null;
  precio: number; qty: number; categoria: string;
  esKg: boolean;
};

const fmt = (n: number) => `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtKg = (q: number) => q >= 1 ? `${q} kg` : `${Math.round(q * 1000)}g`;

export default function Catalogo() {
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [tasa, setTasa]             = useState(0);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState("");
  const [tabActivo, setTabActivo]   = useState("");
  const [catsPrincipales, setCatsPrincipales] = useState<CatPrincipal[]>([]);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]     = useState(false);
  const [qtys, setQtys]             = useState<Record<string, number>>({});
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({});
  const [manualVal, setManualVal]   = useState<Record<string, string>>({});
  const [varModal, setVarModal]     = useState<Producto | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [zona, setZona]             = useState(DELIVERY_ZONES[0].id);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [cartQtyEdit, setCartQtyEdit] = useState<Record<string, string>>({});
  const [notif, setNotif]           = useState("");

  const showNotif = (msg: string) => {
    setNotif(msg);
    setTimeout(() => setNotif(""), 3000);
  };

  useEffect(() => {
    const saved = localStorage.getItem("cart_ramiz");
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, []);
  useEffect(() => {
    if (cart.length) localStorage.setItem("cart_ramiz", JSON.stringify(cart));
    else localStorage.removeItem("cart_ramiz");
  }, [cart]);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: cats }, { data: prods }, { data: vars }] = await Promise.all([
        supabase.from("configuracion").select("value").eq("key", "tasa_bcv").single(),
        supabase.from("categorias").select("id, nombre").order("nombre"),
        supabase
          .from("productos")
          .select("id, nombre, categoria_id, unidad, imagen_url, precio_venta_usd, stock_actual, subcategorias(nombre)")
          .neq("activo", false)
          .order("nombre"),
        supabase.from("producto_variaciones").select("id, nombre, precio_venta_usd, stock_actual, producto_id"),
      ]);

      if (cfg?.value) setTasa(parseFloat(cfg.value));

      const catsList = (cats || []) as CatPrincipal[];
      catsList.sort((a, b) => {
        const ai = CAT_ORDER.findIndex(n => a.nombre.toLowerCase().includes(n));
        const bi = CAT_ORDER.findIndex(n => b.nombre.toLowerCase().includes(n));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      setCatsPrincipales(catsList);
      if (catsList.length) setTabActivo(catsList[0].id);

      const varMap: Record<string, Variante[]> = {};
      (vars || []).forEach((v: any) => {
        if (!varMap[v.producto_id]) varMap[v.producto_id] = [];
        varMap[v.producto_id].push(v);
      });

      const lista = (prods || [])
        .map((p: any) => ({ ...p, subcategoria_nombre: p.subcategorias?.nombre ?? null, variaciones: varMap[p.id] || [] }))
        .filter((p: Producto) => {
          if (p.stock_actual === null && p.variaciones.length === 0) return true;
          const varStock = p.variaciones.reduce((a, v) => a + Number(v.stock_actual ?? 0), 0);
          const total    = p.variaciones.length > 0 ? varStock : Number(p.stock_actual ?? 0);
          return total > 0;
        });

      setProductos(lista as Producto[]);
      setLoading(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(p => {
      const matchTab  = !q && p.categoria_id === tabActivo;
      const matchBusq = q && p.nombre.toLowerCase().includes(q);
      return matchTab || matchBusq;
    });
  }, [productos, tabActivo, busqueda]);

  const grupos = useMemo(() => {
    const g: Record<string, Producto[]> = {};
    filtrados.forEach(p => {
      const sub = p.subcategoria_nombre?.trim() || "General";
      if (!g[sub]) g[sub] = [];
      g[sub].push(p);
    });
    return g;
  }, [filtrados]);

  const cartCount = useMemo(() => cart.reduce((a, i) => a + i.qty, 0), [cart]);
  const subtotal  = useMemo(() => cart.reduce((a, i) => a + i.precio * i.qty, 0), [cart]);

  const getDefaultQty = (p: Producto) => {
    if (isEgg(p.nombre)) return 1;
    return isKgUnit(p.unidad) ? 0.5 : 1;
  };

  const resolveQty = (p: Producto): number => {
    if (manualMode[p.id]) {
      const raw = (manualVal[p.id] || "").trim();
      const num = parseFloat(raw.replace(/[^\d.]/g, ""));
      return isNaN(num) || num <= 0 ? getDefaultQty(p) : num;
    }
    return qtys[p.id] ?? getDefaultQty(p);
  };

  const addToCart = (p: Producto, v?: Variante, qty?: number) => {
    const esKg     = isKgUnit(p.unidad) && !isEgg(p.nombre);
    const key      = v ? `${p.id}__${v.id}` : p.id;
    const nombre   = p.nombre;
    const variante = v?.nombre ?? null;
    const precio   = Number(v?.precio_venta_usd ?? p.precio_venta_usd ?? 0);
    const cantidad = qty ?? resolveQty(p);
    const stockRaw = v !== undefined ? v.stock_actual : p.stock_actual;
    const stock    = stockRaw !== null ? Number(stockRaw) : null;

    setCart(prev => {
      const idx      = prev.findIndex(i => i.key === key);
      const inCart   = idx >= 0 ? prev[idx].qty : 0;
      const newTotal = +(inCart + cantidad).toFixed(3);

      if (stock !== null && newTotal > stock) {
        const restante = +(stock - inCart).toFixed(3);
        const label    = esKg ? fmtKg(stock) : `${stock} unid`;
        if (restante <= 0) {
          setTimeout(() => showNotif(`Solo quedan ${label} y ya están en tu pedido.`), 0);
          return prev;
        }
        setTimeout(() => showNotif(`Solo quedan ${label} disponibles. Se agregó lo que hay.`), 0);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], qty: stock };
          return next;
        }
        return [...prev, { key, nombre, variante, precio, qty: restante, categoria: p.categoria_id || "", esKg }];
      }

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: newTotal };
        return next;
      }
      return [...prev, { key, nombre, variante, precio, qty: cantidad, categoria: p.categoria_id || "", esKg }];
    });
    setCartOpen(true);
  };

  const handleAgregar = (p: Producto) => {
    const varsDisp = p.variaciones.filter(v => Number(v.stock_actual ?? 0) > 0);
    if (varsDisp.length > 1) {
      setPendingQty(qtys[p.id] ?? getDefaultQty(p));
      setVarModal(p);
    } else if (varsDisp.length === 1) {
      addToCart(p, varsDisp[0]);
    } else {
      addToCart(p);
    }
  };

  const updateQty = (key: string, delta: number) => {
    if (delta > 0) {
      const [prodId, varId] = key.split("__");
      const prod = productos.find(p => p.id === prodId);
      if (prod) {
        const stockRaw = varId ? prod.variaciones.find(v => v.id === varId)?.stock_actual ?? null : prod.stock_actual;
        const stock    = stockRaw !== null ? Number(stockRaw) : null;
        const inCart   = cart.find(i => i.key === key)?.qty ?? 0;
        if (stock !== null && inCart + delta > stock) {
          const esKg = isKgUnit(prod.unidad) && !isEgg(prod.nombre);
          showNotif(`Solo quedan ${esKg ? fmtKg(stock) : stock + " unid"} disponibles.`);
          return;
        }
      }
    }
    setCart(prev => prev.map(i => i.key === key ? { ...i, qty: Math.max(0, +(i.qty + delta).toFixed(2)) } : i).filter(i => i.qty > 0));
  };

  const sendWhatsApp = (zoneId: string) => {
    const zone = DELIVERY_ZONES.find(z => z.id === zoneId);
    const fee  = zone?.fee ?? 0;
    const tot  = subtotal + fee;
    const tieneKg = cart.some(i => i.esKg);
    let msg = "*🛒 NUEVO PEDIDO — Charcutería Ramiz*\n\n";
    cart.forEach(i => {
      const qty = i.esKg ? fmtKg(i.qty) : `${i.qty} unid`;
      msg += `• *${i.nombre}*${i.variante ? ` (${i.variante})` : ""}\n`;
      msg += `  Cant: ${qty}  |  Subtotal: ${fmt(i.precio * i.qty)}\n\n`;
    });
    msg += "─────────────────\n";
    msg += `Subtotal: ${fmt(subtotal)}\n`;
    if (zoneId === "retiro") {
      msg += `Delivery: Sin delivery — Retiro directo\n`;
    } else {
      msg += `Delivery (${zone?.name}): ${fmt(fee)}\n`;
    }
    msg += `─────────────────\n`;
    msg += `*TOTAL: ${fmt(tot)}*`;
    if (tasa > 0) msg += ` / Bs. ${(tot * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}`;
    if (tieneKg) msg += `\n\n⚠️ _Nota: El monto total es aproximado._ Los productos vendidos por peso serán confirmados al pesarse.`;
    msg += `\n\n✅ Por favor confírmenme disponibilidad.`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; font-family: 'DM Sans', sans-serif; }
        .ct { min-height: 100vh; background: #fff; font-family: 'DM Sans', sans-serif; color: #1c1008; }

        .ct-hero { background: #1c1008; padding: 14px 16px 12px; display: flex; align-items: center; gap: 10px; }
        .ct-logo-circle { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #f97316, #f59e0b); flex-shrink: 0; }
        .ct-hero-text { flex: 1; min-width: 0; }
        .ct-title { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; font-weight: 600; color: #F7F2EA; line-height: 1.1; }
        .ct-sub { color: #f59e0b; font-size: 0.65rem; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; }

        .ct-search-bar { padding: 10px 12px; background: #fff; border-bottom: 1px solid #f0ebe4; position: relative; }
        .ct-search2 { width: 100%; border: 1.5px solid #f0ebe4; border-radius: 40px; padding: 9px 16px 9px 36px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; outline: none; color: #1c1008; transition: border-color 0.2s; background: #faf8f5; }
        .ct-search2:focus { border-color: #f97316; }
        .ct-search2::placeholder { color: #c4a882; }
        .ct-search-icon2 { position: absolute; left: 24px; top: 50%; transform: translateY(-50%); font-size: 0.85rem; pointer-events: none; }
        .ct-tabs-wrap { background: #fff; border-bottom: 2px solid #e8e0d5; }
        .ct-tabs-row { display: flex; border-bottom: 1px solid #e8e0d5; }
        .ct-tabs-row:last-child { border-bottom: none; justify-content: center; }
        .ct-tab { flex: 1; text-align: center; padding: 11px 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer; color: #7a6050; border-right: 1px solid #e8e0d5; position: relative; transition: color 0.18s, background 0.18s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 33.333%; }
        .ct-tab:last-child { border-right: none; }
        .ct-tabs-row:last-child .ct-tab { border-right: 1px solid #e8e0d5; }
        .ct-tabs-row:last-child .ct-tab:last-child { border-right: none; }
        .ct-tab::after { content: ''; position: absolute; bottom: -2px; left: 50%; width: 0; height: 3px; background: linear-gradient(90deg, #f97316, #f59e0b); transform: translateX(-50%); transition: width 0.22s ease; border-radius: 2px 2px 0 0; }
        .ct-tab:hover { color: #ea580c; background: #fff7f0; }
        .ct-tab.on { color: #ea580c; font-weight: 700; }
        .ct-tab.on::after { width: 70%; }

        .ct-body { padding: 12px 12px 110px; max-width: 700px; margin: 0 auto; }
        .ct-group-title { font-size: 0.88rem; font-weight: 600; color: #9a7a5c; letter-spacing: 0.08em; text-transform: uppercase; padding: 16px 0 8px; border-bottom: 1px solid #f5f0e8; margin-bottom: 10px; }

        /* 2 cols mobile-first → 3 at 480px → 4 at 700px */
        .ct-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 8px; }
        @media (min-width: 480px) { .ct-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 700px) { .ct-grid { grid-template-columns: repeat(4, 1fr); } }

        .ct-card { background: #fff; border: 1px solid #f0ebe4; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: box-shadow 0.15s; }
        .ct-card:hover { box-shadow: 0 4px 14px rgba(28,16,8,0.1); }
        /* 16:9 panoramic photos */
        .ct-img-wrap { aspect-ratio: 16/9; background: #f5f0e8; overflow: hidden; position: relative; }
        .ct-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .ct-card:hover .ct-img { transform: scale(1.05); }
        .ct-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; background: linear-gradient(135deg, #f5f0e8 0%, #ede5d5 100%); }

        .ct-body-card { padding: 8px 8px 10px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .ct-nombre { font-size: 0.92rem; font-weight: 500; color: #1c1008; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ct-precio { font-size: 0.95rem; font-weight: 700; color: #ea580c; }
        .ct-precio-unit { font-size: 0.72rem; color: #9a7a5c; font-weight: 400; }
        .ct-precio-bs { font-size: 0.72rem; color: #9a7a5c; }

        .ct-presets { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 4px; }
        .ct-preset { padding: 6px 2px; font-size: 0.78rem; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid #f0ebe4; background: #fff; color: #5c4a3a; text-align: center; transition: all 0.1s; }
        .ct-preset:hover { border-color: #f97316; color: #ea580c; }
        .ct-preset.on { background: linear-gradient(135deg, #f97316, #f59e0b); color: white; border-color: transparent; }

        .ct-manual-input { width: 100%; margin-top: 4px; padding: 7px 8px; border: 1.5px solid #f97316; border-radius: 7px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; color: #1c1008; outline: none; background: #fff7f0; }
        .ct-manual-input::placeholder { color: #c4a882; }
        .ct-custom-toggle { width: 100%; margin-top: 3px; padding: 4px; background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.74rem; color: #c4a882; cursor: pointer; text-align: center; }
        .ct-custom-toggle:hover { color: #ea580c; }
        .ct-add { width: 100%; padding: 9px 4px; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; border: none; border-radius: 8px; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: opacity 0.15s; margin-top: 5px; }
        .ct-add:hover { opacity: 0.88; }

        /* FAB */
        .ct-fab { position: fixed; bottom: 20px; right: 16px; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; border: none; border-radius: 50px; padding: 13px 20px; font-family: 'DM Sans', sans-serif; font-size: 0.88rem; font-weight: 700; cursor: pointer; box-shadow: 0 4px 18px rgba(249,115,22,0.45); display: flex; align-items: center; gap: 8px; z-index: 100; transition: transform 0.15s; }
        .ct-fab:hover { transform: scale(1.04); }
        .ct-fab-badge { background: white; color: #ea580c; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

        /* Cart Drawer */
        .cd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 150; display: flex; align-items: flex-end; justify-content: center; }
        .cd-drawer { width: 100%; max-width: 520px; max-height: 88dvh; max-height: 88vh; background: #fff; border-radius: 20px 20px 0 0; display: flex; flex-direction: column; overflow: hidden; }
        .cd-handle { width: 36px; height: 4px; background: #e5ddd0; border-radius: 2px; margin: 10px auto 0; flex-shrink: 0; }
        .cd-head { padding: 12px 16px 12px; border-bottom: 1px solid #f0ebe4; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .cd-title { font-family: 'Cormorant Garamond', serif; font-size: 1.35rem; font-weight: 600; color: #1c1008; flex: 1; }
        .cd-badge { background: #ea580c; color: white; border-radius: 50%; width: 24px; height: 24px; font-size: 0.78rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cd-vaciar { background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 0.82rem; color: #ef4444; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: background 0.1s; flex-shrink: 0; }
        .cd-vaciar:hover { background: #fef2f2; }
        .cd-close { background: #f5f0e8; border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.05rem; color: #5c4a3a; flex-shrink: 0; transition: background 0.1s; }
        .cd-close:hover { background: #ede5d5; }

        .cd-scroll { flex: 1; overflow-y: auto; }
        .cd-items { padding: 12px 16px; display: flex; flex-direction: column; gap: 14px; }

        .cd-item { display: flex; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid #f5f0e8; }
        .cd-item:last-child { border-bottom: none; }
        .cd-item-info { flex: 1; min-width: 0; }
        .cd-item-nombre { font-size: 1rem; font-weight: 600; color: #1c1008; }
        .cd-item-var { font-size: 0.82rem; color: #9a7a5c; margin-top: 2px; }
        .cd-item-precio { font-size: 0.88rem; color: #9a7a5c; margin-top: 3px; }
        .cd-qty-row { display: flex; align-items: center; gap: 8px; margin-top: 9px; }
        .cd-qty-btn { background: #fff7f0; border: 1.5px solid #fde8d8; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 1.15rem; color: #ea580c; transition: background 0.1s; flex-shrink: 0; }
        .cd-qty-btn:hover { background: #ffedd5; }
        .cd-qty-input { font-size: 0.95rem; font-weight: 700; color: #1c1008; min-width: 52px; max-width: 64px; text-align: center; border: 1.5px solid #fde8d8; border-radius: 7px; padding: 5px 2px; font-family: 'DM Sans', sans-serif; background: #fff7f0; outline: none; }
        .cd-qty-input:focus { border-color: #f97316; }
        .cd-item-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 8px; }
        .cd-del { background: none; border: none; cursor: pointer; color: #ef4444; font-size: 1.1rem; padding: 2px; transition: opacity 0.1s; }
        .cd-del:hover { opacity: 0.7; }
        .cd-item-total { font-size: 1rem; font-weight: 700; color: #ea580c; white-space: nowrap; }

        .cd-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #9a7a5c; padding: 40px; }
        .cd-empty p { font-size: 1rem; }

        .cd-foot { flex-shrink: 0; border-top: 2px solid #f0ebe4; padding: 12px 16px 20px; background: #fff; display: flex; flex-direction: column; gap: 10px; }
        .cd-seguir { width: 100%; padding: 12px; background: linear-gradient(135deg, #f97316, #f59e0b); border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 0.95rem; font-weight: 700; cursor: pointer; color: white; box-shadow: 0 2px 8px rgba(249,115,22,0.3); transition: opacity 0.15s; }
        .cd-seguir:hover { opacity: 0.9; }
        .cd-sep { border: none; border-top: 1px solid #f0ebe4; }
        .cd-delivery-row { display: flex; align-items: center; gap: 8px; }
        .cd-delivery-label { font-size: 0.95rem; font-weight: 600; color: #1c1008; }
        .cd-check { accent-color: #ea580c; width: 18px; height: 18px; cursor: pointer; }
        .cd-zones { display: flex; flex-direction: column; gap: 7px; padding-left: 26px; }
        .cd-zone-row { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .cd-zone-radio { accent-color: #ea580c; width: 16px; height: 16px; cursor: pointer; }
        .cd-zone-name { font-size: 0.86rem; color: #5c4a3a; flex: 1; }
        .cd-zone-fee { font-size: 0.86rem; font-weight: 700; color: #ea580c; }
        .cd-totals { display: flex; flex-direction: column; gap: 6px; }
        .cd-row { display: flex; justify-content: space-between; font-size: 0.92rem; }
        .cd-row span:first-child { color: #9a7a5c; }
        .cd-row span:last-child { font-weight: 500; color: #1c1008; }
        .cd-total-row { display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 700; padding-top: 8px; border-top: 1px solid #f0ebe4; }
        .cd-total-row span:last-child { color: #ea580c; }
        .cd-total-bs { font-size: 0.75rem; font-weight: 400; color: #9a7a5c; margin-left: 4px; }
        .cd-wa { width: 100%; padding: 16px; background: #16a34a; color: white; border: none; border-radius: 14px; font-family: 'DM Sans', sans-serif; font-size: 1.05rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; letter-spacing: 0.02em; transition: background 0.15s; }
        .cd-wa:hover { background: #15803d; }
        .cd-wa-hint { text-align: center; font-size: 0.78rem; color: #9a7a5c; }

        /* Variant modal */
        .ct-modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 500px) { .ct-modal-ov { align-items: center; } }
        .ct-modal { background: white; border-radius: 20px 20px 0 0; padding: 20px 16px 28px; width: 100%; max-width: 420px; }
        @media (min-width: 500px) { .ct-modal { border-radius: 16px; } }
        .ct-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; font-weight: 600; color: #1c1008; margin-bottom: 2px; }
        .ct-modal-sub { font-size: 0.75rem; color: #9a7a5c; margin-bottom: 14px; }
        .ct-var-list { display: flex; flex-direction: column; gap: 7px; }
        .ct-var-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: #faf8f5; border-radius: 10px; cursor: pointer; border: 1.5px solid transparent; transition: all 0.15s; }
        .ct-var-row:hover { border-color: #f97316; background: #fff7f0; }
        .ct-var-nombre { font-size: 0.88rem; font-weight: 500; color: #1c1008; }
        .ct-var-precio { font-size: 0.85rem; font-weight: 700; color: #ea580c; }
        .ct-modal-cancel { width: 100%; margin-top: 10px; padding: 10px; background: #f5f0e8; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; cursor: pointer; color: #9a7a5c; }

        .ct-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: #9a7a5c; font-style: italic; font-size: 0.88rem; }
        .ct-spinner { width: 30px; height: 30px; border: 3px solid #f5f0e8; border-top-color: #f97316; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ct-footer { text-align: center; padding: 18px; color: #9a7a5c; font-size: 0.7rem; border-top: 1px solid #f5f0e8; background: #fff; }
        .ct-notif { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: #1c1008; color: white; padding: 10px 20px; border-radius: 20px; font-size: 0.82rem; z-index: 999; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.3); max-width: 90vw; text-align: center; }

        /* Delivery modal */
        .dm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 250; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 500px) { .dm-overlay { align-items: center; } }
        .dm-modal { background: white; border-radius: 24px 24px 0 0; padding: 24px 18px 32px; width: 100%; max-width: 480px; }
        @media (min-width: 500px) { .dm-modal { border-radius: 20px; } }
        .dm-title { font-family: 'Cormorant Garamond', serif; font-size: 1.6rem; font-weight: 600; color: #1c1008; margin-bottom: 6px; line-height: 1.2; }
        .dm-sub { font-size: 1rem; color: #9a7a5c; margin-bottom: 20px; line-height: 1.4; }
        .dm-options { display: flex; flex-direction: column; gap: 10px; }
        .dm-option { width: 100%; padding: 16px 18px; background: #faf8f5; border: 2px solid #f0ebe4; border-radius: 14px; cursor: pointer; text-align: left; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
        .dm-option:hover { border-color: #f97316; background: #fff7f0; }
        .dm-option:active { transform: scale(0.98); }
        .dm-option-info { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .dm-option-name { font-size: 1.05rem; font-weight: 600; color: #1c1008; flex: 1; line-height: 1.35; }
        .dm-option-fee { font-size: 1rem; font-weight: 700; color: #ea580c; flex-shrink: 0; }
        .dm-cancel { width: 100%; margin-top: 12px; padding: 14px; background: #f5f0e8; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 1rem; cursor: pointer; color: #9a7a5c; font-weight: 500; }
      `}</style>

      <div className="ct">
        {notif && <div className="ct-notif">{notif}</div>}
        <div className="ct-hero">
          <div className="ct-logo-circle" />
          <div className="ct-hero-text">
            <h1 className="ct-title">Charcutería Ramiz</h1>
            <p className="ct-sub">Catálogo de Productos</p>
          </div>
        </div>

        <div className="ct-search-bar">
          <span className="ct-search-icon2">🔍</span>
          <input
            type="text"
            className="ct-search2"
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); }}
          />
        </div>

        {!busqueda && (
          <div className="ct-tabs-wrap">
            {[catsPrincipales.slice(0, 3), catsPrincipales.slice(3)].filter(row => row.length > 0).map((row, ri) => (
              <div key={ri} className="ct-tabs-row">
                {row.map(c => (
                  <button key={c.id} className={`ct-tab${tabActivo === c.id ? " on" : ""}`} onClick={() => setTabActivo(c.id)}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="ct-loading"><div className="ct-spinner" /><span>Cargando catálogo...</span></div>
        ) : (
          <div className="ct-body">
            {Object.keys(grupos).length === 0 && (
              <div style={{ textAlign:"center", padding:"48px 16px", color:"#9a7a5c" }}>
                <div style={{ fontSize:"2rem", marginBottom:"8px" }}>🥩</div>
                <p style={{ fontSize:"0.88rem" }}>Aún no hay productos en esta categoría.</p>
                <p style={{ fontSize:"0.75rem", marginTop:"4px" }}>Asígnalos desde el sistema interno.</p>
              </div>
            )}
            {Object.keys(grupos).sort().map(sub => (
              <div key={sub}>
                {!(sub === "General" && Object.keys(grupos).length === 1) && (
                  <div className="ct-group-title">{sub}</div>
                )}
                <div className="ct-grid">
                  {grupos[sub].map(p => {
                    const esKg   = isKgUnit(p.unidad);
                    const curQty = qtys[p.id] ?? getDefaultQty(p);
                    const precio = Number(p.variaciones.filter(v => Number(v.stock_actual??0)>0)[0]?.precio_venta_usd ?? p.precio_venta_usd ?? 0);

                    const esHuevo  = isEgg(p.nombre);
                    const presets  = esHuevo ? PRESETS_EGGS : (esKg ? PRESETS_KG : PRESETS_UNIT);
                    const labels   = esHuevo ? LABEL_EGGS   : (esKg ? LABEL_KG   : LABEL_UNIT);
                    const isManual = !!manualMode[p.id];

                    return (
                      <div key={p.id} className="ct-card">
                        <div className="ct-img-wrap">
                          {p.imagen_url
                            ? <img src={p.imagen_url} alt={p.nombre} className="ct-img" loading="lazy" />
                            : <div className="ct-img-ph">🥩</div>
                          }
                        </div>
                        <div className="ct-body-card">
                          <div className="ct-nombre">{p.nombre}</div>
                          {precio > 0 && (
                            <>
                              <div className="ct-precio">
                                {fmt(precio)} <span className="ct-precio-unit">/ {esKg && !esHuevo ? "kg" : "u"}</span>
                              </div>
                              {tasa > 0 && (
                                <div className="ct-precio-bs">Bs. {(precio * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</div>
                              )}
                            </>
                          )}
                          {isManual ? (
                            <input
                              className="ct-manual-input"
                              placeholder={esKg && !esHuevo ? "ej: 0.75" : "ej: 3"}
                              value={manualVal[p.id] || ""}
                              onChange={e => setManualVal(prev => ({ ...prev, [p.id]: e.target.value }))}
                            />
                          ) : (
                            <div className="ct-presets">
                              {presets.map((v, i) => (
                                <button
                                  key={v}
                                  className={`ct-preset${curQty === v ? " on" : ""}`}
                                  onClick={() => setQtys(prev => ({ ...prev, [p.id]: v }))}
                                >
                                  {labels[i]}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            className="ct-custom-toggle"
                            onClick={() => setManualMode(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                          >
                            {isManual ? "← Presets" : "Personalizar"}
                          </button>
                          <button className="ct-add" onClick={() => handleAgregar(p)}>
                            + Agregar al pedido
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="ct-footer">
          Charcutería Ramiz · Precios en USD · Bs al cambio BCV
          {tasa > 0 && <><br />Tasa BCV hoy: <strong>Bs. {tasa.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></>}
        </div>

        {cartCount > 0 && !cartOpen && (
          <button className="ct-fab" onClick={() => setCartOpen(true)}>
            🛒 Ver pedido <span className="ct-fab-badge">{cartCount}</span>
          </button>
        )}
      </div>

      {/* ── Floating Cart Drawer ────────────────────────────────────────────── */}
      {cartOpen && (
        <div className="cd-overlay" onClick={() => setCartOpen(false)}>
          <div className="cd-drawer" onClick={e => e.stopPropagation()}>
            <div className="cd-handle" />
            <div className="cd-head">
              <span className="cd-title">Mi Pedido</span>
              {cartCount > 0 && <span className="cd-badge">{cartCount}</span>}
              {cart.length > 0 && (
                <button className="cd-vaciar" onClick={() => { setCart([]); setCartOpen(false); }}>
                  Vaciar lista
                </button>
              )}
              <button className="cd-close" onClick={() => setCartOpen(false)}>✕</button>
            </div>

            <div className="cd-scroll">
              <div className="cd-items">
                {cart.length === 0 ? (
                  <div className="cd-empty">
                    <span style={{ fontSize: "2.5rem" }}>🛒</span>
                    <p>Tu pedido está vacío</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.key} className="cd-item">
                      <div className="cd-item-info">
                        <div className="cd-item-nombre">{item.nombre}</div>
                        {item.variante && <div className="cd-item-var">{item.variante}</div>}
                        <div className="cd-item-precio">{fmt(item.precio)} / {item.esKg ? "kg" : "unid"}</div>
                        <div className="cd-qty-row">
                          <button className="cd-qty-btn" onClick={() => { updateQty(item.key, item.esKg ? -0.1 : -1); setCartQtyEdit(p => { const n = {...p}; delete n[item.key]; return n; }); }}>−</button>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="cd-qty-input"
                            value={cartQtyEdit[item.key] !== undefined ? cartQtyEdit[item.key] : (item.esKg ? fmtKg(item.qty) : String(item.qty))}
                            onChange={e => setCartQtyEdit(prev => ({ ...prev, [item.key]: e.target.value }))}
                            onFocus={e => { setCartQtyEdit(prev => ({ ...prev, [item.key]: String(item.qty) })); e.target.select(); }}
                            onBlur={() => {
                              const raw = cartQtyEdit[item.key] ?? "";
                              const num = parseFloat(raw.replace(/[^\d.]/g, ""));
                              if (!isNaN(num) && num > 0) setCart(prev => prev.map(i => i.key === item.key ? { ...i, qty: +(num.toFixed(3)) } : i).filter(i => i.qty > 0));
                              setCartQtyEdit(prev => { const n = {...prev}; delete n[item.key]; return n; });
                            }}
                          />
                          <button className="cd-qty-btn" onClick={() => { updateQty(item.key, item.esKg ? 0.1 : 1); setCartQtyEdit(p => { const n = {...p}; delete n[item.key]; return n; }); }}>+</button>
                        </div>
                      </div>
                      <div className="cd-item-right">
                        <button className="cd-del" onClick={() => setCart(prev => prev.filter(i => i.key !== item.key))}>🗑</button>
                        <span className="cd-item-total">{fmt(item.precio * item.qty)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="cd-foot">
                <button className="cd-seguir" onClick={() => setCartOpen(false)}>← Seguir agregando productos</button>
                <hr className="cd-sep" />
                <div className="cd-totals">
                  <div className="cd-total-row">
                    <span>Subtotal</span>
                    <span>
                      {fmt(subtotal)}
                      {tasa > 0 && <span className="cd-total-bs">/ Bs. {(subtotal * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>}
                    </span>
                  </div>
                </div>
                <button className="cd-wa" onClick={() => setDeliveryModal(true)}>
                  <span>💬</span> ENVIAR PEDIDO POR WHATSAPP
                </button>
                <p className="cd-wa-hint">Elegirás tu sector de delivery al confirmar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery modal */}
      {deliveryModal && (
        <div className="dm-overlay" onClick={() => setDeliveryModal(false)}>
          <div className="dm-modal" onClick={e => e.stopPropagation()}>
            <div className="dm-title">¿Dónde te encuentras?</div>
            <div className="dm-sub">Selecciona tu sector y te calculamos el delivery al instante</div>
            <div className="dm-options">
              <button className="dm-option" onClick={() => { setDeliveryModal(false); sendWhatsApp("th"); }}>
                <div className="dm-option-info">
                  <span className="dm-option-name">📍 Estoy en Terrazas Amarillas, Azules o Verdes</span>
                  <span className="dm-option-fee">+$0.40</span>
                </div>
              </button>
              <button className="dm-option" onClick={() => { setDeliveryModal(false); sendWhatsApp("otros"); }}>
                <div className="dm-option-info">
                  <span className="dm-option-name">📍 Estoy en Laguna, Arado, Tejados, Casablanca o Terrazas Edif</span>
                  <span className="dm-option-fee">+$0.80</span>
                </div>
              </button>
              <button className="dm-option" onClick={() => { setDeliveryModal(false); sendWhatsApp("zafra"); }}>
                <div className="dm-option-info">
                  <span className="dm-option-name">📍 Estoy en La Zafra, Panelas u otro sector</span>
                  <span className="dm-option-fee">+$1.00</span>
                </div>
              </button>
              <button className="dm-option" onClick={() => { setDeliveryModal(false); sendWhatsApp("retiro"); }}>
                <div className="dm-option-info">
                  <span className="dm-option-name">🚶 Lo voy a buscar — Retiro directo</span>
                  <span className="dm-option-fee" style={{ color: "#16a34a" }}>Gratis</span>
                </div>
              </button>
            </div>
            <button className="dm-cancel" onClick={() => setDeliveryModal(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Variant modal */}
      {varModal && (
        <div className="ct-modal-ov" onClick={() => setVarModal(null)}>
          <div className="ct-modal" onClick={e => e.stopPropagation()}>
            <div className="ct-modal-title">{varModal.nombre}</div>
            <div className="ct-modal-sub">Elige una variante — qty: {isKgUnit(varModal.unidad) ? fmtKg(pendingQty) : pendingQty}</div>
            <div className="ct-var-list">
              {varModal.variaciones.filter(v => Number(v.stock_actual??0)>0).map(v => (
                <div key={v.id} className="ct-var-row" onClick={() => { addToCart(varModal, v, pendingQty); setVarModal(null); }}>
                  <span className="ct-var-nombre">{v.nombre}</span>
                  {v.precio_venta_usd ? <span className="ct-var-precio">{fmt(Number(v.precio_venta_usd))}</span> : null}
                </div>
              ))}
            </div>
            <button className="ct-modal-cancel" onClick={() => setVarModal(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}
