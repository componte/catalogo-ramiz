import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://iblufmwrggywzosuobpk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlibHVmbXdyZ2d5d3pvc3VvYnBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NTE2MTEsImV4cCI6MjA4OTEyNzYxMX0.PcJSENVSePE3gfIGDmJguc2VPAHyzQPAfVgtC0Bk_oA"
);

const LOGO_URL = "https://res.cloudinary.com/dpfk35vqc/image/upload/v1775250448/IMG_6554_klsr9i.png";
const WHATSAPP_NUMBER = "584141291930";

type Variante = {
  id: string;
  nombre: string;
  precio_venta_usd: number | null;
  stock_actual: number | null;
};

type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  imagen_url: string | null;
  precio_venta_usd: number | null;
  stock_actual: number | null;
  variaciones: Variante[];
};

type CartItem = {
  key: string;
  productoId: string;
  varianteId: string | null;
  nombre: string;
  variante: string | null;
  precio: number;
  qty: number;
};

const fmt = (n: number) =>
  `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tasa, setTasa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [variantModal, setVariantModal] = useState<Producto | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: cfg }, { data: prods }, { data: vars }] = await Promise.all([
        supabase.from("configuracion").select("value").eq("key", "tasa_bcv").single(),
        supabase
          .from("productos")
          .select("id, nombre, categoria, imagen_url, precio_venta_usd, stock_actual")
          .neq("activo", false)
          .order("nombre"),
        supabase
          .from("producto_variaciones")
          .select("id, nombre, precio_venta_usd, stock_actual, producto_id"),
      ]);

      if (cfg?.value) setTasa(parseFloat(cfg.value));

      const varMap: Record<string, Variante[]> = {};
      (vars || []).forEach((v: any) => {
        if (!varMap[v.producto_id]) varMap[v.producto_id] = [];
        varMap[v.producto_id].push(v);
      });

      const lista = (prods || [])
        .map((p: any) => ({ ...p, variaciones: varMap[p.id] || [] }))
        .filter((p: Producto) => {
          const varStock = p.variaciones.reduce((acc, v) => acc + Number(v.stock_actual ?? 0), 0);
          const totalStock = p.variaciones.length > 0 ? varStock : Number(p.stock_actual ?? 0);
          return totalStock > 0;
        });

      setProductos(lista);
      setLoading(false);
    })();
  }, []);

  const categorias = useMemo(() => {
    const cats = new Set(productos.map((p) => p.categoria?.trim() || "General"));
    return ["Todos", ...Array.from(cats).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    return productos.filter((p) => {
      const cat = p.categoria?.trim() || "General";
      const matchCat = categoria === "Todos" || cat === categoria;
      const matchBusq =
        !busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoria || "").toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchBusq;
    });
  }, [productos, categoria, busqueda]);

  const cartTotal = useMemo(() => cart.reduce((acc, i) => acc + i.precio * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((acc, i) => acc + i.qty, 0), [cart]);

  const addToCart = (p: Producto, v?: Variante) => {
    const key = v ? `${p.id}__${v.id}` : p.id;
    const precio = Number(v?.precio_venta_usd ?? p.precio_venta_usd ?? 0);
    const nombre = p.nombre;
    const variante = v?.nombre ?? null;
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { key, productoId: p.id, varianteId: v?.id ?? null, nombre, variante, precio, qty: 1 }];
    });
  };

  const handleAgregar = (p: Producto) => {
    const varsDisp = p.variaciones.filter((v) => Number(v.stock_actual ?? 0) > 0);
    if (varsDisp.length > 1) {
      setVariantModal(p);
    } else if (varsDisp.length === 1) {
      addToCart(p, varsDisp[0]);
    } else {
      addToCart(p);
    }
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const sendWhatsApp = () => {
    if (!cart.length) return;
    let msg = "Hola! Quiero hacer el siguiente pedido:\n\n";
    cart.forEach((i) => {
      msg += `• ${i.nombre}${i.variante ? ` (${i.variante})` : ""} x${i.qty} — ${fmt(i.precio * i.qty)}\n`;
    });
    msg += `\n*TOTAL: ${fmt(cartTotal)}*`;
    if (tasa > 0) msg += ` / Bs. ${(cartTotal * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const precioLabel = (p: Producto) => {
    const vars = p.variaciones.filter((v) => Number(v.stock_actual ?? 0) > 0);
    if (vars.length === 0) return p.precio_venta_usd ? fmt(Number(p.precio_venta_usd)) : "Consultar";
    const precios = vars.map((v) => Number(v.precio_venta_usd ?? p.precio_venta_usd ?? 0)).filter(Boolean);
    if (!precios.length) return "Consultar";
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? fmt(min) : `${fmt(min)}+`;
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --crema: #F7F2EA;
          --espresso: #1C1008;
          --terracota: #B8491F;
          --oro: #C8983A;
          --hueso: #EDE5D5;
          --texto: #2D1E0F;
          --texto-suave: #7A5C44;
        }
        body { background: var(--crema); }
        .c-wrap { min-height: 100vh; background: var(--crema); font-family: 'DM Sans', sans-serif; color: var(--texto); }

        /* Hero */
        .c-hero {
          background: var(--espresso);
          padding: 32px 16px 28px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .c-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(200,152,58,0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .c-logo { width: 60px; height: 60px; border-radius: 50%; border: 2px solid rgba(200,152,58,0.5); object-fit: contain; margin-bottom: 12px; }
        .c-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(1.6rem, 5vw, 3rem); font-weight: 600; color: var(--crema); line-height: 1.1; }
        .c-sub { color: var(--oro); font-size: 0.75rem; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 4px; }
        .c-search-wrap { max-width: 400px; margin: 18px auto 0; position: relative; }
        .c-search {
          width: 100%;
          background: rgba(247,242,234,0.1);
          border: 1px solid rgba(200,152,58,0.3);
          border-radius: 40px;
          padding: 10px 16px 10px 38px;
          color: var(--crema);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .c-search::placeholder { color: rgba(247,242,234,0.4); }
        .c-search:focus { border-color: var(--oro); }
        .c-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(200,152,58,0.7); font-size: 0.9rem; pointer-events: none; }

        /* Cats */
        .c-cats { display: flex; gap: 6px; overflow-x: auto; padding: 14px 12px 6px; scrollbar-width: none; }
        .c-cats::-webkit-scrollbar { display: none; }
        .c-chip {
          flex-shrink: 0;
          padding: 5px 14px;
          border-radius: 40px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          border: 1.5px solid transparent;
          white-space: nowrap;
          background: var(--hueso);
          color: var(--texto-suave);
          transition: all 0.15s;
        }
        .c-chip:hover { border-color: var(--terracota); color: var(--terracota); }
        .c-chip.on { background: var(--espresso); color: var(--crema); border-color: var(--espresso); }

        /* Count */
        .c-count { text-align: center; color: var(--texto-suave); font-size: 0.72rem; padding: 4px 12px 8px; }

        /* Grid — 3 cols mobile, más en desktop */
        .c-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 4px 10px 100px;
          max-width: 1100px;
          margin: 0 auto;
        }
        @media (min-width: 600px) { .c-grid { grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 4px 16px 100px; } }
        @media (min-width: 900px) { .c-grid { grid-template-columns: repeat(5, 1fr); gap: 14px; } }

        /* Card */
        .c-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 6px rgba(28,16,8,0.07); display: flex; flex-direction: column; }
        .c-img-wrap { position: relative; aspect-ratio: 1/1; background: var(--hueso); overflow: hidden; }
        .c-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
        .c-card:hover .c-img { transform: scale(1.04); }
        .c-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2rem; background: linear-gradient(135deg, var(--hueso) 0%, #e8ddc8 100%); }
        .c-cat-tag {
          position: absolute; top: 6px; left: 6px;
          background: rgba(28,16,8,0.72); color: var(--crema);
          font-size: 0.58rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 20px; backdrop-filter: blur(4px);
        }
        .c-body { padding: 8px; flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .c-nombre {
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--espresso);
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .c-precio { font-size: 0.82rem; font-weight: 600; color: var(--terracota); }
        .c-precio-bs { font-size: 0.68rem; color: var(--texto-suave); }
        .c-add-btn {
          margin-top: auto;
          padding: 7px 4px;
          background: var(--espresso);
          color: var(--crema);
          border: none;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: background 0.15s;
          width: 100%;
        }
        .c-add-btn:hover { background: var(--terracota); }

        /* Cart FAB */
        .c-fab {
          position: fixed;
          bottom: 20px;
          right: 16px;
          background: var(--terracota);
          color: white;
          border: none;
          border-radius: 50px;
          padding: 14px 20px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(184,73,31,0.45);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.15s, background 0.15s;
          z-index: 100;
        }
        .c-fab:hover { background: #9e3a14; transform: scale(1.04); }
        .c-fab-badge {
          background: white;
          color: var(--terracota);
          border-radius: 50%;
          width: 20px;
          height: 20px;
          font-size: 0.72rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Cart drawer */
        .c-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 200; }
        .c-drawer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 85vh;
          background: white;
          border-radius: 20px 20px 0 0;
          z-index: 201;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (min-width: 600px) {
          .c-drawer { left: auto; width: 400px; right: 24px; bottom: 24px; border-radius: 16px; max-height: 80vh; }
        }
        .c-drawer-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--hueso);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .c-drawer-title { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 600; color: var(--espresso); }
        .c-close-btn { background: var(--hueso); border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; }
        .c-drawer-items { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
        .c-item { display: flex; align-items: center; gap: 10px; padding: 8px; background: var(--crema); border-radius: 10px; }
        .c-item-info { flex: 1; min-width: 0; }
        .c-item-nombre { font-size: 0.85rem; font-weight: 500; color: var(--espresso); truncate: true; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .c-item-var { font-size: 0.72rem; color: var(--texto-suave); }
        .c-item-precio { font-size: 0.82rem; font-weight: 600; color: var(--terracota); white-space: nowrap; }
        .c-qty { display: flex; align-items: center; gap: 6px; }
        .c-qty-btn { background: white; border: 1px solid var(--hueso); border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; color: var(--espresso); transition: background 0.1s; }
        .c-qty-btn:hover { background: var(--hueso); }
        .c-qty-num { font-size: 0.85rem; font-weight: 600; color: var(--espresso); min-width: 18px; text-align: center; }
        .c-empty-cart { text-align: center; padding: 40px 20px; color: var(--texto-suave); }
        .c-empty-cart p { font-size: 0.9rem; margin-top: 8px; }
        .c-drawer-footer { padding: 16px; border-top: 1px solid var(--hueso); }
        .c-total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .c-total-label { font-size: 0.85rem; color: var(--texto-suave); }
        .c-total-val { font-size: 1.1rem; font-weight: 700; color: var(--espresso); }
        .c-total-bs { font-size: 0.75rem; color: var(--texto-suave); text-align: right; }
        .c-wa-btn {
          width: 100%;
          padding: 14px;
          background: #25D366;
          color: white;
          border: none;
          border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.15s;
        }
        .c-wa-btn:hover { background: #1da851; }

        /* Variant modal */
        .c-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 600px) { .c-modal-overlay { align-items: center; } }
        .c-modal {
          background: white;
          border-radius: 20px 20px 0 0;
          padding: 20px;
          width: 100%;
          max-width: 440px;
          max-height: 70vh;
          overflow-y: auto;
        }
        @media (min-width: 600px) { .c-modal { border-radius: 16px; } }
        .c-modal-title { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; font-weight: 600; color: var(--espresso); margin-bottom: 4px; }
        .c-modal-sub { font-size: 0.78rem; color: var(--texto-suave); margin-bottom: 16px; }
        .c-var-list { display: flex; flex-direction: column; gap: 8px; }
        .c-var-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: var(--crema);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .c-var-row:hover { background: var(--hueso); }
        .c-var-nombre { font-size: 0.88rem; font-weight: 500; color: var(--espresso); }
        .c-var-precio { font-size: 0.85rem; font-weight: 600; color: var(--terracota); }
        .c-modal-cancel { width: 100%; margin-top: 12px; padding: 10px; background: var(--hueso); border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; cursor: pointer; color: var(--texto-suave); }

        /* Loading */
        .c-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; gap: 12px; color: var(--texto-suave); font-style: italic; font-size: 0.9rem; }
        .c-spinner { width: 32px; height: 32px; border: 3px solid var(--hueso); border-top-color: var(--terracota); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .c-no-results { grid-column: 1/-1; text-align: center; padding: 40px 16px; color: var(--texto-suave); }
        .c-no-results h3 { font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; color: var(--texto); margin-bottom: 6px; }

        /* Footer */
        .c-footer { text-align: center; padding: 20px; color: var(--texto-suave); font-size: 0.72rem; border-top: 1px solid var(--hueso); background: white; }
      `}</style>

      <div className="c-wrap">
        {/* Hero */}
        <div className="c-hero">
          <img src={LOGO_URL} alt="Logo" className="c-logo" />
          <h1 className="c-title">Charcutería Ramiz</h1>
          <p className="c-sub">Catálogo de Productos</p>
          <div className="c-search-wrap">
            <span className="c-search-icon">🔍</span>
            <input
              type="text"
              className="c-search"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="c-cats">
          {categorias.map((c) => (
            <button key={c} className={`c-chip${categoria === c ? " on" : ""}`} onClick={() => setCategoria(c)}>
              {c}
            </button>
          ))}
        </div>

        {!loading && (
          <p className="c-count">{filtrados.length} {filtrados.length === 1 ? "producto disponible" : "productos disponibles"}</p>
        )}

        {/* Grid */}
        {loading ? (
          <div className="c-loading">
            <div className="c-spinner" />
            <span>Cargando catálogo...</span>
          </div>
        ) : (
          <div className="c-grid">
            {filtrados.length === 0 ? (
              <div className="c-no-results">
                <h3>Sin resultados</h3>
                <p>No encontramos productos con esa búsqueda.</p>
              </div>
            ) : (
              filtrados.map((p) => {
                const precio = precioLabel(p);
                const precioNum = Number(p.variaciones.filter(v => Number(v.stock_actual??0)>0)[0]?.precio_venta_usd ?? p.precio_venta_usd ?? 0);
                return (
                  <div key={p.id} className="c-card">
                    <div className="c-img-wrap">
                      {p.imagen_url
                        ? <img src={p.imagen_url} alt={p.nombre} className="c-img" loading="lazy" />
                        : <div className="c-img-ph">🥩</div>
                      }
                      {p.categoria && <span className="c-cat-tag">{p.categoria}</span>}
                    </div>
                    <div className="c-body">
                      <div className="c-nombre">{p.nombre}</div>
                      <div className="c-precio">{precio}</div>
                      {tasa > 0 && precioNum > 0 && (
                        <div className="c-precio-bs">Bs. {(precioNum * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</div>
                      )}
                      <button className="c-add-btn" onClick={() => handleAgregar(p)}>
                        🛒 Agregar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="c-footer">Charcutería Ramiz · Precios en USD · Bs al cambio BCV</div>

        {/* FAB carrito */}
        {cartCount > 0 && (
          <button className="c-fab" onClick={() => setCartOpen(true)}>
            🛒 Ver pedido
            <span className="c-fab-badge">{cartCount}</span>
          </button>
        )}

        {/* Cart drawer */}
        {cartOpen && (
          <>
            <div className="c-overlay" onClick={() => setCartOpen(false)} />
            <div className="c-drawer">
              <div className="c-drawer-header">
                <span className="c-drawer-title">Tu pedido</span>
                <button className="c-close-btn" onClick={() => setCartOpen(false)}>✕</button>
              </div>
              <div className="c-drawer-items">
                {cart.length === 0 ? (
                  <div className="c-empty-cart">
                    <div style={{ fontSize: "2rem" }}>🛒</div>
                    <p>Tu carrito está vacío</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.key} className="c-item">
                      <div className="c-item-info">
                        <div className="c-item-nombre">{item.nombre}</div>
                        {item.variante && <div className="c-item-var">{item.variante}</div>}
                        <div className="c-item-precio">{fmt(item.precio * item.qty)}</div>
                      </div>
                      <div className="c-qty">
                        <button className="c-qty-btn" onClick={() => updateQty(item.key, -1)}>−</button>
                        <span className="c-qty-num">{item.qty}</span>
                        <button className="c-qty-btn" onClick={() => updateQty(item.key, 1)}>+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {cart.length > 0 && (
                <div className="c-drawer-footer">
                  <div className="c-total-row">
                    <span className="c-total-label">Total</span>
                    <div>
                      <div className="c-total-val">{fmt(cartTotal)}</div>
                      {tasa > 0 && (
                        <div className="c-total-bs">Bs. {(cartTotal * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</div>
                      )}
                    </div>
                  </div>
                  <button className="c-wa-btn" onClick={sendWhatsApp}>
                    <span>💬</span> Enviar pedido por WhatsApp
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal variantes */}
        {variantModal && (
          <div className="c-modal-overlay" onClick={() => setVariantModal(null)}>
            <div className="c-modal" onClick={(e) => e.stopPropagation()}>
              <div className="c-modal-title">{variantModal.nombre}</div>
              <div className="c-modal-sub">Elige una variante</div>
              <div className="c-var-list">
                {variantModal.variaciones
                  .filter((v) => Number(v.stock_actual ?? 0) > 0)
                  .map((v) => (
                    <div
                      key={v.id}
                      className="c-var-row"
                      onClick={() => {
                        addToCart(variantModal, v);
                        setVariantModal(null);
                      }}
                    >
                      <span className="c-var-nombre">{v.nombre}</span>
                      <span className="c-var-precio">
                        {v.precio_venta_usd ? fmt(Number(v.precio_venta_usd)) : "Consultar"}
                      </span>
                    </div>
                  ))}
              </div>
              <button className="c-modal-cancel" onClick={() => setVariantModal(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
