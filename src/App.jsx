
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tareas, setTareas] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("Todas");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);

  const formularioInicial = {
    titulo: "",
    descripcion: "",
    prioridad: "Media",
    estado: "Pendiente",
    fecha_vencimiento: ""
  };

  const [form, setForm] = useState(formularioInicial);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUsuario(data.session?.user ?? null);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUsuario(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (usuario) cargarTareas();
    else setTareas([]);
  }, [usuario]);

  async function acceder(e) {
    e.preventDefault();
    setMensaje("Procesando...");

    try {
      if (modo === "registro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        if (data.session) {
          setMensaje("Cuenta creada correctamente.");
        } else {
          setMensaje("Cuenta creada. Revisa tu correo para confirmar el acceso.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
        setMensaje("");
      }
    } catch (error) {
      setMensaje(error.message);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setTareas([]);
    setEmail("");
    setPassword("");
  }

  async function cargarTareas() {
    const { data, error } = await supabase
      .from("tareas")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMensaje("Error cargando tareas: " + error.message);
      return;
    }

    setTareas(data || []);
  }

  async function guardarTarea(e) {
    e.preventDefault();

    const datos = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion,
      prioridad: form.prioridad,
      estado: form.estado,
      fecha_vencimiento: form.fecha_vencimiento || null
    };

    if (!datos.titulo) return;

    let resultado;

    if (editando) {
      resultado = await supabase
        .from("tareas")
        .update(datos)
        .eq("id", editando);
    } else {
      resultado = await supabase
        .from("tareas")
        .insert({
          ...datos,
          user_id: usuario.id
        });
    }

    if (resultado.error) {
      setMensaje("No se pudo guardar: " + resultado.error.message);
      return;
    }

    cerrarFormulario();
    setMensaje("Tarea guardada correctamente.");
    await cargarTareas();
  }

  function abrirEdicion(tarea) {
    setForm({
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || "",
      prioridad: tarea.prioridad,
      estado: tarea.estado,
      fecha_vencimiento: tarea.fecha_vencimiento || ""
    });
    setEditando(tarea.id);
    setMostrarFormulario(true);
  }

  function cerrarFormulario() {
    setMostrarFormulario(false);
    setEditando(null);
    setForm(formularioInicial);
  }

  async function eliminarTarea(id) {
    if (!window.confirm("¿Deseas eliminar esta tarea?")) return;

    const { error } = await supabase
      .from("tareas")
      .delete()
      .eq("id", id);

    if (error) {
      setMensaje("Error eliminando: " + error.message);
      return;
    }

    setMensaje("Tarea eliminada.");
    await cargarTareas();
  }

  async function cambiarEstado(tarea) {
    const siguiente = tarea.estado === "Pendiente"
      ? "En progreso"
      : tarea.estado === "En progreso"
        ? "Completada"
        : "Pendiente";

    const { error } = await supabase
      .from("tareas")
      .update({ estado: siguiente })
      .eq("id", tarea.id);

    if (error) {
      setMensaje("Error actualizando: " + error.message);
      return;
    }

    await cargarTareas();
  }

  const tareasFiltradas = tareas.filter(t => {
    const texto = (t.titulo + " " + (t.descripcion || "")).toLowerCase();
    const coincide = texto.includes(busqueda.toLowerCase());

    return coincide && (
      filtro === "Todas" || t.estado === filtro
    );
  });

  const pendientes = tareas.filter(t => t.estado === "Pendiente").length;
  const progreso = tareas.filter(t => t.estado === "En progreso").length;
  const completadas = tareas.filter(t => t.estado === "Completada").length;

  if (cargando) {
    return <div className="pantalla-acceso">Cargando TaskFlow...</div>;
  }

  if (!usuario) {
    return (
      <div className="pantalla-acceso">
        <form className="acceso-card" onSubmit={acceder}>
          <div className="acceso-logo">✓</div>
          <h1>TaskFlow</h1>
          <p>Organiza tu día. Alcanza tus metas.</p>

          <h2>{modo === "login" ? "Bienvenida de nuevo" : "Crear cuenta"}</h2>

          <label>Correo electrónico</label>
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label>Contraseña</label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <button className="add-btn acceso-boton" type="submit">
            {modo === "login" ? "Iniciar sesión" : "Registrarme"}
          </button>

          {mensaje && <p className="mensaje-acceso">{mensaje}</p>}

          <p className="cambiar-modo">
            {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
            <button
              type="button"
              onClick={() => {
                setModo(modo === "login" ? "registro" : "login");
                setMensaje("");
              }}
            >
              {modo === "login" ? " Regístrate" : " Inicia sesión"}
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo"><span>✓</span> TaskFlow</div>
        <p className="menu-label">MENÚ PRINCIPAL</p>
        <button className="menu-active">▦ &nbsp; Mis tareas</button>
        <div className="sidebar-bottom">
          Organiza tu día.<br />Alcanza tus metas.
          <button className="logout-btn" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <span className="eyebrow">GESTIÓN PERSONAL</span>
            <h1>Mis tareas</h1>
            <p>Bienvenida, {usuario.email}</p>
          </div>
          <button className="add-btn" onClick={() => setMostrarFormulario(true)}>
            + Nueva tarea
          </button>
        </header>

        <section className="stats">
          <div className="stat"><span>📋</span><p>Total de tareas</p><strong>{tareas.length}</strong></div>
          <div className="stat"><span>🕒</span><p>Pendientes</p><strong>{pendientes}</strong></div>
          <div className="stat"><span>⚡</span><p>En progreso</p><strong>{progreso}</strong></div>
          <div className="stat"><span>✓</span><p>Completadas</p><strong>{completadas}</strong></div>
        </section>

        <section className="content">
          <div className="toolbar">
            <input
              placeholder="Buscar tareas..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
            <select value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option>Todas</option>
              <option>Pendiente</option>
              <option>En progreso</option>
              <option>Completada</option>
            </select>
          </div>

          <div className="task-heading">
            <h2>Lista de actividades</h2>
            <span>{tareasFiltradas.length} tareas</span>
          </div>

          <div className="task-list">
            {tareasFiltradas.map(tarea => (
              <article className="task" key={tarea.id}>
                <button className="task-check" onClick={() => cambiarEstado(tarea)}>✓</button>
                <div className="task-info">
                  <h3>{tarea.titulo}</h3>
                  <p>{tarea.descripcion}</p>
                  <div className="task-meta">
                    <span className={"priority " + tarea.prioridad.toLowerCase()}>{tarea.prioridad}</span>
                    <span className="status">{tarea.estado}</span>
                    <span>📅 {tarea.fecha_vencimiento || "Sin fecha"}</span>
                  </div>
                </div>
                <div className="actions">
                  <button onClick={() => abrirEdicion(tarea)}>✎</button>
                  <button onClick={() => eliminarTarea(tarea.id)}>🗑</button>
                </div>
              </article>
            ))}

            {tareasFiltradas.length === 0 && (
              <p className="empty">No se encontraron tareas.</p>
            )}
          </div>
        </section>

        {mensaje && <p className="mensaje-app">{mensaje}</p>}

        {mostrarFormulario && (
          <div className="modal">
            <form className="modal-card" onSubmit={guardarTarea}>
              <h2>{editando ? "Editar tarea" : "Nueva tarea"}</h2>

              <input
                placeholder="Título de la tarea"
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                required
              />

              <textarea
                placeholder="Descripción"
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
              />

              <label>Fecha de vencimiento</label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
              />

              <label>Prioridad</label>
              <select
                value={form.prioridad}
                onChange={e => setForm({ ...form, prioridad: e.target.value })}
              >
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
              </select>

              <label>Estado</label>
              <select
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value })}
              >
                <option>Pendiente</option>
                <option>En progreso</option>
                <option>Completada</option>
              </select>

              <div className="modal-actions">
                <button type="button" className="cancel" onClick={cerrarFormulario}>
                  Cancelar
                </button>
                <button type="submit" className="add-btn">
                  Guardar tarea
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
