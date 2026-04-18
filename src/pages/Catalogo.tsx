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

const fmt = (n: number, symbol = "$") =>
  `${symbol} ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tasa, setTasa] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [expandido, setExpandido] = useState<string | null>(null);

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

  const precioDisplay = (p: Producto) => {
    const vars = p.variaciones.filter((v) => Number(v.stock_actual ?? 0) > 0);
    if (vars.length === 0) return p.precio_venta_usd;
    const precios = vars.map((v) => Number(v.precio_venta_usd ?? p.precio_venta_usd ?? 0)).filter(Boolean);
    if (!precios.length) return p.precio_venta_usd;
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? min : { min, max };
  };

  const openWhatsapp = (p: Producto) => {
    const msg = encodeURIComponent(`Hola! Me interesa: ${p.nombre}`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  };

  return (
    <>
      <style>{`
        :root {
          --crema: #F7F2EA;
          --espresso: #1C1008;
          --terracota: #B8491F;
          --oro: #C8983A;
          --hueso: #EDE5D5;
          --texto: #2D1E0F;
          --texto-suave: #7A5C44;
        }
        .catalogo-body {
          min-height: 100vh;
          background-color: var(--crema);
          font-family: 'DM Sans', sans-serif;
          color: var(--texto);
        }
        .catalogo-hero {
          background-color: var(--espresso);
          padding: 48px 24px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .catalogo-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(200,152,58,0.18) 0%, transparent 70%);
          pointer-events: none;
        }
        .catalogo-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          border-radius: 50%;
          border: 2px solid rgba(200,152,58,0.5);
          margin-bottom: 16px;
        }
        .catalogo-titulo {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 600;
          color: var(--crema);
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0 0 6px;
        }
        .catalogo-subtitulo {
          color: var(--oro);
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin: 0;
        }
        .catalogo-search-wrap {
          max-width: 480px;
          margin: 24px auto 0;
          position: relative;
        }
        .catalogo-search {
          width: 100%;
          background: rgba(247,242,234,0.1);
          border: 1px solid rgba(200,152,58,0.3);
          border-radius: 40px;
          padding: 12px 20px 12px 44px;
          color: var(--crema);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .catalogo-search::placeholder { color: rgba(247,242,234,0.4); }
        .catalogo-search:focus { border-color: var(--oro); }
        .catalogo-search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(200,152,58,0.7);
          font-size: 1rem;
          pointer-events: none;
        }
        .catalogo-cats-scroll {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 20px 20px 4px;
          max-width: 1100px;
          margin: 0 auto;
          scrollbar-width: none;
        }
        .catalogo-cats-scroll::-webkit-scrollbar { display: none; }
        .catalogo-cat-chip {
          flex-shrink: 0;
          padding: 7px 18px;
          border-radius: 40px;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1.5px solid transparent;
          white-space: nowrap;
          background: var(--hueso);
          color: var(--texto-suave);
        }
        .catalogo-cat-chip:hover {
          border-color: var(--terracota);
          color: var(--terracota);
        }
        .catalogo-cat-chip.activo {
          background: var(--espresso);
          color: var(--crema);
          border-color: var(--espresso);
        }
        .catalogo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
          max-width: 1100px;
          margin: 0 auto;
          padding: 8px 20px 48px;
        }
        .catalogo-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(28,16,8,0.07);
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: default;
        }
        .catalogo-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(28,16,8,0.13);
        }
        .catalogo-img-wrap {
          position: relative;
          aspect-ratio: 4/3;
          background: var(--hueso);
          overflow: hidden;
        }
        .catalogo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.35s;
        }
        .catalogo-card:hover .catalogo-img { transform: scale(1.04); }
        .catalogo-img-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--hueso) 0%, #e8ddc8 100%);
          color: var(--texto-suave);
          font-size: 2.5rem;
        }
        .catalogo-cat-tag {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(28,16,8,0.75);
          color: var(--crema);
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 3px 10px;
          border-radius: 20px;
          backdrop-filter: blur(4px);
        }
        .catalogo-card-body {
          padding: 16px;
        }
        .catalogo-nombre {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--espresso);
          line-height: 1.25;
          margin: 0 0 10px;
        }
        .catalogo-precio-usd {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--terracota);
          letter-spacing: -0.01em;
        }
        .catalogo-precio-bs {
          font-size: 0.8rem;
          color: var(--texto-suave);
          margin-top: 2px;
        }
        .catalogo-precio-rango {
          font-size: 0.78rem;
          color: var(--texto-suave);
          margin-top: 2px;
          font-style: italic;
        }
        .catalogo-variantes-toggle {
          margin-top: 12px;
          width: 100%;
          background: var(--hueso);
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--texto-suave);
          cursor: pointer;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.15s;
        }
        .catalogo-variantes-toggle:hover { background: #e2d8c8; }
        .catalogo-variantes-list {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .catalogo-variante-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
          background: var(--crema);
          border-radius: 6px;
          font-size: 0.8rem;
        }
        .catalogo-variante-nombre { color: var(--texto); font-weight: 400; }
        .catalogo-variante-precio { color: var(--terracota); font-weight: 600; }
        .catalogo-wa-btn {
          margin-top: 12px;
          width: 100%;
          padding: 10px;
          background: var(--espresso);
          color: var(--crema);
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.2s;
          letter-spacing: 0.03em;
        }
        .catalogo-wa-btn:hover { background: var(--terracota); }
        .catalogo-empty {
          grid-column: 1/-1;
          text-align: center;
          padding: 60px 20px;
          color: var(--texto-suave);
        }
        .catalogo-empty h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.5rem;
          margin: 0 0 8px;
          color: var(--texto);
        }
        .catalogo-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          gap: 16px;
          color: var(--texto-suave);
          font-style: italic;
        }
        .catalogo-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid var(--hueso);
          border-top-color: var(--terracota);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .catalogo-footer {
          text-align: center;
          padding: 24px;
          color: var(--texto-suave);
          font-size: 0.75rem;
          border-top: 1px solid var(--hueso);
          background: white;
        }
        .catalogo-count {
          text-align: center;
          color: var(--texto-suave);
          font-size: 0.78rem;
          padding: 0 20px 12px;
          max-width: 1100px;
          margin: 0 auto;
        }
        @media (max-width: 500px) {
          .catalogo-grid { grid-template-columns: 1fr; gap: 14px; }
        }
      `}</style>

      <div className="catalogo-body">
        {/* Hero */}
        <div className="catalogo-hero">
          <img src={LOGO_URL} alt="Logo" className="catalogo-logo" />
          <h1 className="catalogo-titulo">Charcutería Ramiz</h1>
          <p className="catalogo-subtitulo">Catálogo de Productos</p>
          <div className="catalogo-search-wrap">
            <span className="catalogo-search-icon">🔍</span>
            <input
              type="text"
              className="catalogo-search"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        {/* Categorías */}
        <div className="catalogo-cats-scroll">
          {categorias.map((c) => (
            <button
              key={c}
              className={`catalogo-cat-chip${categoria === c ? " activo" : ""}`}
              onClick={() => setCategoria(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Contador */}
        {!loading && (
          <p className="catalogo-count">
            {filtrados.length} {filtrados.length === 1 ? "producto disponible" : "productos disponibles"}
          </p>
        )}

        {/* Grid */}
        <div className="catalogo-grid">
          {loading ? (
            <div className="catalogo-loading" style={{ gridColumn: "1/-1" }}>
              <div className="catalogo-spinner" />
              <span>Cargando catálogo...</span>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="catalogo-empty">
              <h3>Sin resultados</h3>
              <p>No encontramos productos con esa búsqueda.</p>
            </div>
          ) : (
            filtrados.map((p) => {
              const precio = precioDisplay(p);
              const esRango = typeof precio === "object" && precio !== null;
              const varsDisponibles = p.variaciones.filter((v) => Number(v.stock_actual ?? 0) > 0);
              const tieneVars = varsDisponibles.length > 1;
              const abierto = expandido === p.id;

              return (
                <div key={p.id} className="catalogo-card">
                  <div className="catalogo-img-wrap">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="catalogo-img" loading="lazy" />
                    ) : (
                      <div className="catalogo-img-placeholder">🥩</div>
                    )}
                    {p.categoria && (
                      <span className="catalogo-cat-tag">{p.categoria}</span>
                    )}
                  </div>

                  <div className="catalogo-card-body">
                    <h2 className="catalogo-nombre">{p.nombre}</h2>

                    {esRango ? (
                      <>
                        <div className="catalogo-precio-usd">
                          {fmt((precio as { min: number; max: number }).min)} — {fmt((precio as { min: number; max: number }).max)}
                        </div>
                        {tasa > 0 && (
                          <div className="catalogo-precio-bs">
                            Bs. {((precio as { min: number; max: number }).min * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })} — {((precio as { min: number; max: number }).max * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}
                          </div>
                        )}
                        <div className="catalogo-precio-rango">Ver variantes para detalles</div>
                      </>
                    ) : precio != null && Number(precio) > 0 ? (
                      <>
                        <div className="catalogo-precio-usd">{fmt(Number(precio))}</div>
                        {tasa > 0 && (
                          <div className="catalogo-precio-bs">Bs. {(Number(precio) * tasa).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</div>
                        )}
                      </>
                    ) : (
                      <div className="catalogo-precio-usd" style={{ color: "var(--texto-suave)", fontSize: "0.85rem" }}>
                        Consultar precio
                      </div>
                    )}

                    {tieneVars && (
                      <>
                        <button
                          className="catalogo-variantes-toggle"
                          onClick={() => setExpandido(abierto ? null : p.id)}
                        >
                          <span>{varsDisponibles.length} variantes disponibles</span>
                          <span>{abierto ? "▲" : "▼"}</span>
                        </button>
                        {abierto && (
                          <div className="catalogo-variantes-list">
                            {varsDisponibles.map((v) => {
                              const pv = Number(v.precio_venta_usd ?? 0);
                              return (
                                <div key={v.id} className="catalogo-variante-item">
                                  <span className="catalogo-variante-nombre">{v.nombre}</span>
                                  {pv > 0 ? (
                                    <span className="catalogo-variante-precio">{fmt(pv)}</span>
                                  ) : (
                                    <span className="catalogo-variante-precio" style={{ opacity: 0.5 }}>—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    <button className="catalogo-wa-btn" onClick={() => openWhatsapp(p)}>
                      <span>💬</span> Pedir por WhatsApp
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="catalogo-footer">
          Charcutería Ramiz · Todos los precios en USD · Bs al cambio BCV
        </div>
      </div>
    </>
  );
}
