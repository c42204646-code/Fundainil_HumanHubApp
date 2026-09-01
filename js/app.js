// ============================================================================
// IMPORTACIONES DE DATOS
// Traemos los catálogos desde nuestro archivo data.js
// ============================================================================
import { rolesPermitidos, dbSectores, dbTemas, dbEdades, adendaIndicadoresOficiales } from './data.js';

// ============================================================================
// OBJETO GLOBAL Y ESTADO DE LA APLICACIÓN
// ============================================================================
window.humanHubApp = {}; // Creamos un espacio global para que el HTML pueda llamar a estas funciones

// Variables de estado
let usuarioActual = null;
let sectorSeleccionado = null;
let dataSimuladaBD = JSON.parse(localStorage.getItem('humanhub_bd_reportes')) || [];
let metasConfiguradas = JSON.parse(localStorage.getItem('humanhub_metas')) || {};
let indicadoresEditados = JSON.parse(localStorage.getItem('humanhub_indicadores')) || [...adendaIndicadoresOficiales];
let informesEnviadosDireccion = JSON.parse(localStorage.getItem('humanhub_informes_oficiales')) || [];
let perfilUsuario = JSON.parse(localStorage.getItem('humanhub_perfil')) || { nombre: '' };

let chartDemoInstance = null;
let chartVulnerabilidadInstance = null;
let chartMetasInstance = null;
let chartProfesionalesInstance = null;

// ============================================================================
// INICIALIZACIÓN (Se ejecuta al cargar la página)
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Quitar el cargador inicial
    setTimeout(() => {
        const loader = document.getElementById('cargador-inicial');
        if(loader) {
            loader.classList.remove('fade-in');
            loader.classList.add('slide-up');
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 800);

    // 2. Cargar perfil y datos iniciales
    if (perfilUsuario.nombre) document.getElementById('perfil-nombre').value = perfilUsuario.nombre;
    
    // 3. Pintar los sectores en la pantalla inicial
    window.humanHubApp.cargarSelectorSectores();

    // 4. Configurar fechas por defecto en el dashboard (Mes actual)
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];
    document.getElementById('dash-desde').value = primerDia;
    document.getElementById('dash-hasta').value = ultimoDia;
    document.getElementById('in-fecha').value = hoy.toISOString().split('T')[0];
});

// ============================================================================
// UTILIDADES UI (Navegación, Toasts, Modales)
// ============================================================================
window.humanHubApp.showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-xl shadow-lg text-white text-sm font-bold flex items-center transform transition-all translate-y-10 opacity-0 ${type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-brand-600'}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle'} mr-2"></i> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.remove('translate-y-10', 'opacity-0'); }, 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

window.humanHubApp.cambiarPista = (pista) => {
    document.getElementById('vista-selector').classList.add('hidden');
    document.getElementById('vista-formulario').classList.add('hidden');
    document.getElementById('vista-documento').classList.add('hidden');
    document.getElementById('vista-dashboard').classList.add('hidden');
    document.getElementById(`vista-${pista}`).classList.remove('hidden');

    if(pista !== 'dashboard' && pista !== 'selector') {
        document.getElementById('btn-tab-formulario').classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        document.getElementById('btn-tab-dashboard').classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
        document.getElementById('btn-tab-dashboard').classList.add('text-slate-500');
    } else if (pista === 'dashboard') {
        document.getElementById('btn-tab-dashboard').classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        document.getElementById('btn-tab-formulario').classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
        document.getElementById('btn-tab-formulario').classList.add('text-slate-500');
        window.humanHubApp.actualizarDashboard();
    }
};

window.humanHubApp.abrirModalLogin = () => document.getElementById('modal-login').classList.remove('hidden');
window.humanHubApp.cerrarModalLogin = () => {
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('input-clave').value = '';
};

window.humanHubApp.verificarClave = () => {
    const clave = document.getElementById('input-clave').value.trim().toLowerCase();
    
    if (rolesPermitidos[clave]) {
        usuarioActual = rolesPermitidos[clave];
        window.humanHubApp.showToast(`Bienvenido: ${usuarioActual.label}`);
        document.getElementById('texto-rol').textContent = usuarioActual.label;
        
        if (usuarioActual.rol === 'director' || usuarioActual.rol === 'coordinador') {
            document.getElementById('btn-tab-dashboard').classList.remove('hidden');
            document.getElementById('rol-icono-bg').classList.replace('bg-brand-500', usuarioActual.rol === 'director' ? 'bg-amber-500' : 'bg-purple-500');
            document.getElementById('rol-icono-bg').innerHTML = usuarioActual.rol === 'director' ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-star"></i>';
            window.humanHubApp.cambiarPista('dashboard');
        }
        window.humanHubApp.cerrarModalLogin();
    } else {
        window.humanHubApp.showToast('Clave no autorizada', 'error');
    }
};

// ============================================================================
// LÓGICA DEL FORMULARIO DE CAMPO
// ============================================================================
window.humanHubApp.cargarSelectorSectores = () => {
    const grid = document.getElementById('grid-sectores');
    grid.innerHTML = dbSectores.map(s => `
        <div onclick="window.humanHubApp.seleccionarSector('${s.id}')" class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-${s.color.split('-')[1]}-400 hover:shadow-md transition cursor-pointer group flex flex-col items-center text-center">
            <div class="w-16 h-16 rounded-2xl ${s.colorBg} ${s.color} flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform"><i class="fa-solid ${s.icono}"></i></div>
            <h3 class="text-lg font-bold text-slate-800">${s.nombre}</h3>
            <p class="text-xs text-slate-500 mt-2">Registrar actividad comunitaria o entrega de insumos.</p>
        </div>
    `).join('');
    window.humanHubApp.cambiarPista('selector');
};

window.humanHubApp.seleccionarSector = (sectorId) => {
    sectorSeleccionado = dbSectores.find(s => s.id === sectorId);
    document.getElementById('lbl-sector-actual').textContent = sectorSeleccionado.nombre;
    document.getElementById('in-sector-id').value = sectorSeleccionado.id;
    document.getElementById('in-sector-nombre').value = sectorSeleccionado.nombre;
    document.getElementById('icono-sector-actual').className = `fa-solid ${sectorSeleccionado.icono} ${sectorSeleccionado.color}`;
    
    // Cargar Catálogos Específicos
    window.humanHubApp.cargarTemas(sectorSeleccionado.id);
    window.humanHubApp.generarTablaEdades(sectorSeleccionado.id);
    
    // UI Condicional (Mostrar/Ocultar Casos de Protección)
    const divProteccion = document.getElementById('contenedor-casos-proteccion');
    if (sectorSeleccionado.id === 'proteccion') {
        divProteccion.classList.remove('hidden');
    } else {
        divProteccion.classList.add('hidden');
    }

    window.humanHubApp.cambiarPista('formulario');
};

window.humanHubApp.cargarTemas = (sectorId) => {
    const temas = dbTemas[sectorId] || ['Actividad General'];
    const select = document.getElementById('in-actividad');
    select.innerHTML = '<option value="">Seleccione...</option>' + temas.map(t => `<option value="${t}">${t}</option>`).join('');
    
    const temasAdenda = adendaIndicadoresOficiales.filter(ind => ind.sector.toUpperCase() === sectorSeleccionado.nombre.toUpperCase());
    const selectTema = document.getElementById('in-tema');
    if(temasAdenda.length > 0) {
         selectTema.innerHTML = '<option value="">Seleccione enfoque principal...</option>' + temasAdenda.map(t => `<option value="${t.componente}">${t.componente}</option>`).join('');
    } else {
         selectTema.innerHTML = '<option value="General">Intervención General</option>';
    }
};

window.humanHubApp.actualizarMunicipios = () => {
    const estado = document.getElementById('in-estado').value;
    const municipio = document.getElementById('in-municipio');
    municipio.innerHTML = '<option value="">Seleccione...</option>';
    municipio.disabled = !estado;
    
    if (estado === 'Distrito Capital') municipio.innerHTML += '<option value="Libertador">Libertador</option>';
    else if (estado === 'Miranda') municipio.innerHTML += '<option value="Sucre">Sucre</option><option value="Chacao">Chacao</option><option value="Baruta">Baruta</option><option value="Independencia">Independencia</option>';
    else if (estado === 'La Guaira') municipio.innerHTML += '<option value="Vargas">Vargas</option>';
};

window.humanHubApp.actualizarParroquias = () => {
    const mun = document.getElementById('in-municipio').value;
    const parr = document.getElementById('in-parroquia');
    parr.innerHTML = '<option value="">Seleccione...</option>';
    parr.disabled = !mun;
    
    if (mun === 'Sucre') parr.innerHTML += '<option value="Petare">Petare</option><option value="Leoncio Martinez">Leoncio Martinez</option><option value="Caucaguita">Caucaguita</option><option value="La Dolorita">La Dolorita</option><option value="Fila de Mariches">Fila de Mariches</option>';
    else if (mun === 'Libertador') parr.innerHTML += '<option value="Sucre (Catia)">Sucre (Catia)</option><option value="Antimano">Antimano</option><option value="El Valle">El Valle</option>';
    else if (mun === 'Independencia') parr.innerHTML += '<option value="Santa Teresa del Tuy">Santa Teresa del Tuy</option>';
    else if (mun === 'Vargas') parr.innerHTML += '<option value="Catia La Mar">Catia La Mar</option><option value="Urimare">Urimare</option><option value="Maiquetía">Maiquetía</option>';
};

window.humanHubApp.capturarUbicacion = (btn) => {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Buscando...';
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                document.getElementById('in-lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('in-lng').value = pos.coords.longitude.toFixed(6);
                btn.innerHTML = '<i class="fa-solid fa-check text-green-600 mr-1"></i> GPS OK';
                window.humanHubApp.showToast('Ubicación capturada con éxito.');
            },
            () => {
                btn.innerHTML = '<i class="fa-solid fa-location-crosshairs mr-1"></i> Usar GPS';
                window.humanHubApp.showToast('Error al obtener ubicación. Revisa permisos.', 'error');
            }
        );
    }
};

window.humanHubApp.toggleTransversal = (tipo) => {
    const panel = document.getElementById(`panel-${tipo}`);
    let isOpen;
    if(tipo === 'pqr') {
        const icon = document.getElementById('icon-pqr');
        isOpen = panel.classList.toggle('open');
        icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    } else {
        const checkbox = document.getElementById(`tgg-${tipo}`);
        isOpen = checkbox.checked;
        if(isOpen) { panel.classList.add('open'); } 
        else { panel.classList.remove('open'); }
    }
};

window.humanHubApp.generarTablaEdades = (sectorId) => {
    const tbody = document.getElementById('tbody-edades-dinamico');
    const edades = dbEdades[sectorId] || dbEdades['default'];
    
    tbody.innerHTML = edades.map((edad, index) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-2 border-r border-slate-200 text-left font-medium text-slate-700">${edad.label}</td>
            <td class="p-1 border-r border-slate-200"><input type="number" min="0" value="0" class="w-full text-center py-1 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-pink-300 rounded input-edad" data-grupo="${edad.label}" data-genero="femenino" data-tipo="no-recurrente"></td>
            <td class="p-1 border-r border-slate-200"><input type="number" min="0" value="0" class="w-full text-center py-1 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-pink-300 rounded input-edad" data-grupo="${edad.label}" data-genero="femenino" data-tipo="recurrente"></td>
            <td class="p-1 border-r border-slate-200"><input type="number" min="0" value="0" class="w-full text-center py-1 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded input-edad" data-grupo="${edad.label}" data-genero="masculino" data-tipo="no-recurrente"></td>
            <td class="p-1 border-r border-slate-200"><input type="number" min="0" value="0" class="w-full text-center py-1 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded input-edad" data-grupo="${edad.label}" data-genero="masculino" data-tipo="recurrente"></td>
            <td class="p-2 font-bold text-slate-800 bg-slate-50/50" id="tot-fila-${index}">0</td>
        </tr>
    `).join('');

    document.querySelectorAll('.input-edad').forEach(input => {
        input.addEventListener('input', window.humanHubApp.calcularTotales);
    });
};

window.humanHubApp.calcularTotales = () => {
    let granTotal = 0;
    const filas = document.getElementById('tbody-edades-dinamico').querySelectorAll('tr');
    
    filas.forEach((fila, index) => {
        let totalFila = 0;
        fila.querySelectorAll('input').forEach(input => {
            const val = parseInt(input.value) || 0;
            totalFila += val;
            granTotal += val;
        });
        document.getElementById(`tot-fila-${index}`).textContent = totalFila;
    });
    
    document.getElementById('gran-total').textContent = granTotal;
    
    // Auto-completar vulnerabilidades como sugerencia
    const mujeresFila = Array.from(filas).map(f => parseInt(f.querySelectorAll('input')[0].value) || 0).reduce((a,b)=>a+b,0);
    if(document.getElementById('vul-embarazadas').value == "0") document.getElementById('vul-embarazadas').value = Math.floor(mujeresFila * 0.05); // Demo IA
};

window.humanHubApp.agregarFilaMaterial = () => {
    const lista = document.getElementById('lista-materiales');
    const div = document.createElement('div');
    div.className = 'flex gap-3 items-center slide-up';
    div.innerHTML = `
        <input type="text" placeholder="Ej. Jabón azul, Cuadernos..." class="flex-grow px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm input-material-nombre focus:ring-2 focus:ring-brand-500">
        <input type="number" placeholder="Cant." min="1" class="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center outline-none text-sm input-material-cant focus:ring-2 focus:ring-brand-500">
        <button type="button" onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-600 p-2"><i class="fa-solid fa-trash"></i></button>
    `;
    lista.appendChild(div);
};

window.humanHubApp.previsualizarFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            document.getElementById('foto-preview').src = event.target.result;
            document.getElementById('foto-preview-container').classList.remove('hidden');
            document.getElementById('foto-placeholder').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
};

window.humanHubApp.generarNarrativaAutomatica = () => {
    const btn = document.getElementById('btn-ia-auto');
    const txt = document.getElementById('in-narrativa-final');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Analizando datos...';
    
    setTimeout(() => {
        const act = document.getElementById('in-actividad').value || 'la actividad';
        const com = document.getElementById('in-comunidad').value || 'la comunidad';
        const total = document.getElementById('gran-total').textContent;
        const logros = document.getElementById('in-logros').value || 'participación activa';
        const sector = document.getElementById('in-sector-nombre').value;
        
        let transversales = [];
        if(document.getElementById('tgg-gen').checked) transversales.push("enfoque de género");
        if(document.getElementById('tgg-aap').checked) transversales.push("rendición de cuentas");
        if(document.getElementById('tgg-peas').checked) transversales.push("prevención PEAS");
        
        let textoTrans = transversales.length > 0 ? ` Se integraron ejes transversales de ${transversales.join(', ')}.` : '';

        txt.value = `En el marco de la respuesta humanitaria sector ${sector}, el equipo de FUNDAINIL se desplegó en ${com} para ejecutar ${act}. \n\nDurante la jornada, se logró alcanzar a ${total} personas, destacando como logro principal: ${logros}.${textoTrans} \n\nLa comunidad se mostró receptiva y participativa frente a las intervenciones realizadas.`;
        
        btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Generado con IA';
        btn.classList.replace('bg-blue-600', 'bg-emerald-600');
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-2"></i> Regenerar Informe';
            btn.classList.replace('bg-emerald-600', 'bg-blue-600');
        }, 3000);
    }, 1500);
};

window.humanHubApp.procesarReporte = () => {
    // Validaciones básicas
    if(!document.getElementById('in-profesional').value || !document.getElementById('in-fecha').value || !document.getElementById('in-municipio').value) {
        window.humanHubApp.showToast('Por favor, completa los campos requeridos con (*)', 'error');
        return;
    }

    const btn = document.getElementById('btn-generar');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-3"></i> Procesando Matriz M&E...';
    
    setTimeout(() => {
        // 1. Recopilar Datos de Población
        const poblacion = [];
        document.querySelectorAll('#tbody-edades-dinamico tr').forEach(fila => {
            const inputs = fila.querySelectorAll('input');
            const grupo = inputs[0].dataset.grupo;
            poblacion.push({
                grupo: grupo,
                f_nor: parseInt(inputs[0].value) || 0,
                f_r: parseInt(inputs[1].value) || 0,
                m_nor: parseInt(inputs[2].value) || 0,
                m_r: parseInt(inputs[3].value) || 0
            });
        });

        // 2. Recopilar Insumos
        const insumos = [];
        document.querySelectorAll('.input-material-nombre').forEach((input, i) => {
            if(input.value) {
                const cant = document.querySelectorAll('.input-material-cant')[i].value || 1;
                insumos.push({ nombre: input.value, cantidad: cant });
            }
        });

        // 3. Recopilar Transversales y PQR (NUEVO)
        const transversalesData = {
            gen: {
                activo: document.getElementById('tgg-gen').checked,
                ninas: parseInt(document.getElementById('gen-ninas').value) || 0,
                ninos: parseInt(document.getElementById('gen-ninos').value) || 0,
                mujeres: parseInt(document.getElementById('gen-mujeres').value) || 0,
                hombres: parseInt(document.getElementById('gen-hombres').value) || 0
            },
            aap: {
                activo: document.getElementById('tgg-aap').checked,
                info: {
                    ninas: parseInt(document.getElementById('aap1-ninas').value) || 0, ninos: parseInt(document.getElementById('aap1-ninos').value) || 0,
                    mujeres: parseInt(document.getElementById('aap1-mujeres').value) || 0, hombres: parseInt(document.getElementById('aap1-hombres').value) || 0
                },
                decisiones: {
                    ninas: parseInt(document.getElementById('aap2-ninas').value) || 0, ninos: parseInt(document.getElementById('aap2-ninos').value) || 0,
                    mujeres: parseInt(document.getElementById('aap2-mujeres').value) || 0, hombres: parseInt(document.getElementById('aap2-hombres').value) || 0
                }
            },
            peas: {
                activo: document.getElementById('tgg-peas').checked,
                sensibilizacion: {
                    ninas: parseInt(document.getElementById('peas1-ninas').value) || 0, ninos: parseInt(document.getElementById('peas1-ninos').value) || 0,
                    mujeres: parseInt(document.getElementById('peas1-mujeres').value) || 0, hombres: parseInt(document.getElementById('peas1-hombres').value) || 0
                },
                riesgo: {
                    ninas: parseInt(document.getElementById('peas2-ninas').value) || 0, ninos: parseInt(document.getElementById('peas2-ninos').value) || 0,
                    mujeres: parseInt(document.getElementById('peas2-mujeres').value) || 0, hombres: parseInt(document.getElementById('peas2-hombres').value) || 0
                },
                consultas: {
                    ninas: parseInt(document.getElementById('peas3-ninas').value) || 0, ninos: parseInt(document.getElementById('peas3-ninos').value) || 0,
                    mujeres: parseInt(document.getElementById('peas3-mujeres').value) || 0, hombres: parseInt(document.getElementById('peas3-hombres').value) || 0
                }
            },
            pqr: {
                info: parseInt(document.getElementById('pqr-info').value) || 0,
                asistencia: parseInt(document.getElementById('pqr-asistencia').value) || 0,
                buzon: parseInt(document.getElementById('pqr-buzon').value) || 0,
                queja: parseInt(document.getElementById('pqr-queja').value) || 0
            }
        };

        // 4. Construir Objeto Maestro del Reporte
        const reporte = {
            id: 'REP-' + Date.now().toString().slice(-6),
            fechaCreacion: new Date().toISOString(),
            sectorId: document.getElementById('in-sector-id').value,
            sectorNombre: document.getElementById('in-sector-nombre').value,
            profesionales: document.getElementById('in-profesional').value,
            periodo: document.getElementById('in-periodo').value,
            actividad: document.getElementById('in-actividad').value,
            tema: document.getElementById('in-tema').value,
            fecha: document.getElementById('in-fecha').value,
            estado: document.getElementById('in-estado').value,
            municipio: document.getElementById('in-municipio').value,
            parroquia: document.getElementById('in-parroquia').value,
            comunidad: document.getElementById('in-comunidad').value,
            lat: document.getElementById('in-lat').value,
            lng: document.getElementById('in-lng').value,
            poblacion: poblacion,
            totalAlcanzado: parseInt(document.getElementById('gran-total').textContent),
            vulnerabilidades: {
                discapacidad: document.getElementById('vul-discapacidad').value,
                embarazadas: document.getElementById('vul-embarazadas').value,
                adol_emb: document.getElementById('vul-adol-emb').value,
                lgbti: document.getElementById('vul-lgbti').value,
                indigenas: document.getElementById('vul-indigenas').value
            },
            transversales: transversalesData,
            insumos: insumos,
            cualitativo: {
                receptividad: document.getElementById('in-receptividad').value,
                logros: document.getElementById('in-logros').value,
                desafios: document.getElementById('in-desafios').value,
                testimonio: document.getElementById('in-testimonio').value,
                narrativaOficial: document.getElementById('in-narrativa-final').value || 'Sin narrativa generada.'
            },
            foto: document.getElementById('foto-preview').src
        };

        // Guardar temporalmente en ventana para exportar/guardar
        window.reporteActual = reporte;
        
        // Renderizar vista previa PDF
        window.humanHubApp.renderizarVistaPreviaPDF(reporte);
        
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-3"></i> Procesar y Publicar Informe';
        window.humanHubApp.cambiarPista('documento');
        
    }, 1000);
};

window.humanHubApp.renderizarVistaPreviaPDF = (data) => {
    const container = document.getElementById('documento-final');
    
    // Calcular totales agrupados
    let totNinos = 0, totAdultos = 0, totMujeres = 0, totHombres = 0;
    data.poblacion.forEach(p => {
        const totalFila = p.f_nor + p.f_r + p.m_nor + p.m_r;
        if(p.grupo.toLowerCase().includes('meses') || p.grupo.toLowerCase().includes('año') && parseInt(p.grupo.match(/\d+/)[0]) < 18) {
            totNinos += totalFila;
        } else {
            totAdultos += totalFila;
        }
        totMujeres += (p.f_nor + p.f_r);
        totHombres += (p.m_nor + p.m_r);
    });

    let tablaPoblacionHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 15px;">
            <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                    <th style="padding: 6px;">Grupo</th>
                    <th style="padding: 6px;">F (No-R)</th><th style="padding: 6px;">F (R)</th>
                    <th style="padding: 6px;">M (No-R)</th><th style="padding: 6px;">M (R)</th>
                </tr>
            </thead>
            <tbody>
                ${data.poblacion.map(p => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 4px;">${p.grupo}</td>
                        <td style="padding: 4px;">${p.f_nor}</td><td style="padding: 4px;">${p.f_r}</td>
                        <td style="padding: 4px;">${p.m_nor}</td><td style="padding: 4px;">${p.m_r}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; color: #334155;">
            <!-- Cabecera -->
            <div style="border-bottom: 3px solid #003366; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <img src="https://static.wixstatic.com/media/8aebba_9455cbe95cfb4aa183dde97c176546f2~mv2.png" style="height: 40px; margin-bottom: 10px;">
                    <h2 style="font-size: 18px; font-weight: 800; color: #003366; margin: 0;">REPORTE OFICIAL DE ACTIVIDAD M&E</h2>
                    <p style="font-size: 10px; color: #64748b; margin: 2px 0;">ID: ${data.id} | Fecha Emisión: ${new Date().toLocaleDateString()}</p>
                </div>
                <div style="text-align: right;">
                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 5px 10px; border-radius: 5px; display: inline-block;">
                        <span style="font-size: 10px; font-weight: bold; color: #166534; display: block;">SECTOR</span>
                        <span style="font-size: 14px; font-weight: 900; color: #14532d;">${data.sectorNombre.toUpperCase()}</span>
                    </div>
                </div>
            </div>

            <!-- Ficha Técnica -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div>
                    <h4 style="font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 8px;">Contexto</h4>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Periodo:</strong> ${data.periodo}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Fecha Ejecución:</strong> ${data.fecha}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Profesional(es):</strong> ${data.profesionales}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Actividad:</strong> ${data.actividad}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Tema/Indicador:</strong> ${data.tema}</p>
                </div>
                <div>
                    <h4 style="font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 8px;">Ubicación</h4>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Estado:</strong> ${data.estado}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Municipio:</strong> ${data.municipio}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Parroquia:</strong> ${data.parroquia}</p>
                    <p style="font-size: 11px; margin: 3px 0;"><strong>Establecimiento:</strong> ${data.comunidad}</p>
                    <p style="font-size: 10px; margin: 3px 0; color: #64748b;"><strong>GPS:</strong> ${data.lat}, ${data.lng}</p>
                </div>
            </div>

            <!-- Módulo de Alcance -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h4 style="font-size: 12px; font-weight: 800; color: #003366; margin-top: 0; margin-bottom: 15px;">ALCANCE POBLACIONAL: <span style="font-size: 16px; color: #2563eb;">${data.totalAlcanzado}</span> Personas</h4>
                ${tablaPoblacionHTML}
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                    <div><span style="font-size: 9px; color: #64748b; display: block;">Mujeres</span><span style="font-size: 12px; font-weight: bold; color: #db2777;">${totMujeres}</span></div>
                    <div><span style="font-size: 9px; color: #64748b; display: block;">Hombres</span><span style="font-size: 12px; font-weight: bold; color: #2563eb;">${totHombres}</span></div>
                    <div><span style="font-size: 9px; color: #64748b; display: block;">Niños/as (<18)</span><span style="font-size: 12px; font-weight: bold; color: #059669;">${totNinos}</span></div>
                    <div><span style="font-size: 9px; color: #64748b; display: block;">Adultos (18+)</span><span style="font-size: 12px; font-weight: bold; color: #d97706;">${totAdultos}</span></div>
                </div>
            </div>

            <!-- Narrativa y Transversales -->
            <div style="margin-bottom: 20px;">
                <h4 style="font-size: 11px; text-transform: uppercase; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 8px;">Análisis de Intervención</h4>
                <p style="font-size: 11px; text-align: justify; line-height: 1.5; background-color: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 5px; font-style: italic;">"${data.cualitativo.narrativaOficial}"</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <!-- PQR y Transversales Resumen -->
                <div>
                     <h4 style="font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 5px;">Mecanismos y Transversales</h4>
                     <ul style="font-size: 10px; margin: 0; padding-left: 15px; color: #475569;">
                        <li><strong>Género (GEN):</strong> ${data.transversales.gen.activo ? 'Aplicado' : 'No reportado'}</li>
                        <li><strong>AAP:</strong> ${data.transversales.aap.activo ? 'Aplicado' : 'No reportado'}</li>
                        <li><strong>PEAS:</strong> ${data.transversales.peas.activo ? 'Aplicado' : 'No reportado'}</li>
                        <li><strong>Quejas Recibidas:</strong> ${data.transversales.pqr.queja}</li>
                     </ul>
                </div>
                 <!-- Insumos -->
                ${data.insumos.length > 0 ? `
                <div>
                    <h4 style="font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 5px;">Insumos Entregados</h4>
                    <ul style="font-size: 10px; margin: 0; padding-left: 15px; color: #475569;">
                        ${data.insumos.map(i => `<li>${i.cantidad}x ${i.nombre}</li>`).join('')}
                    </ul>
                </div>` : ''}
            </div>
        </div>
    `;
};

window.humanHubApp.guardarReporteBD = () => {
    const btn = document.getElementById('btn-guardar-bd');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Guardando...';
    
    setTimeout(() => {
        // Guardar en LocalStorage para que no se pierda al recargar
        dataSimuladaBD.push(window.reporteActual);
        localStorage.setItem('humanhub_bd_reportes', JSON.stringify(dataSimuladaBD));
        
        window.humanHubApp.showToast('¡Reporte oficializado y guardado en Base de Datos!');
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Guardado Correctamente';
        btn.classList.replace('bg-secondary-600', 'bg-slate-400');
        btn.disabled = true;
        
        // Limpiar Formulario para el siguiente
        document.getElementById('form-reporte').reset();
        document.getElementById('gran-total').textContent = '0';
        document.getElementById('foto-preview-container').classList.add('hidden');
        document.getElementById('foto-placeholder').classList.remove('hidden');
        document.getElementById('lista-materiales').innerHTML = '';
        
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up mr-2"></i> Guardar BD';
            btn.classList.replace('bg-slate-400', 'bg-secondary-600');
            btn.disabled = false;
            window.humanHubApp.cambiarPista('selector');
        }, 2000);
    }, 800);
};

window.humanHubApp.generarPDF = () => {
    const elemento = document.getElementById('documento-final');
    const opt = {
        margin:       0,
        filename:     `HumanHub_Reporte_${window.reporteActual?.id || 'Doc'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(elemento).save();
};

// ============================================================================
// DASHBOARD Y CENTRO DE MANDO (DIRECTOR / COORDINADOR)
// ============================================================================
window.humanHubApp.cambiarTabDash = (tabId) => {
    const tabs = ['metricas', 'metas', 'cualitativos', 'config'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-dash-${t}`);
        const panel = document.getElementById(`dash-panel-${t}`);
        if(t === tabId) {
            panel.classList.remove('hidden');
            btn.classList.add('text-brand-600', 'border-b-2', 'border-brand-600');
            btn.classList.remove('text-slate-500', 'border-transparent');
        } else {
            panel.classList.add('hidden');
            btn.classList.remove('text-brand-600', 'border-b-2', 'border-brand-600');
            btn.classList.add('text-slate-500', 'border-transparent');
        }
    });

    if(tabId === 'cualitativos') window.humanHubApp.renderizarTablasCualitativas();
};

window.humanHubApp.actualizarDashboard = () => {
    if(!usuarioActual) return;

    // Configurar visibilidad de filtros según rol
    const contenedorFiltroSectores = document.getElementById('contenedor-multisector-director');
    const selectFiltroSector = document.getElementById('dash-filtro-sector');
    
    if (usuarioActual.rol === 'director') {
        contenedorFiltroSectores.classList.remove('hidden');
        selectFiltroSector.innerHTML = '<option value="Todos">Todas las Áreas (Consolidado)</option>' + dbSectores.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    } else {
        contenedorFiltroSectores.classList.add('hidden');
    }

    // Filtrar BD local según rol y fechas
    const fechaDesde = new Date(document.getElementById('dash-desde').value);
    const fechaHasta = new Date(document.getElementById('dash-hasta').value);
    const sectorFiltro = selectFiltroSector.value;

    let bdFiltrada = dataSimuladaBD.filter(rep => {
        const f = new Date(rep.fecha);
        return f >= fechaDesde && f <= fechaHasta;
    });

    // Filtro por Rol/Sector
    if (usuarioActual.rol === 'coordinador') {
        bdFiltrada = bdFiltrada.filter(r => r.sectorNombre.toLowerCase() === usuarioActual.sector.toLowerCase());
        document.getElementById('titulo-centro-mando').innerHTML = `<i class="fa-solid fa-star text-purple-500 mr-2"></i>Panel de Coordinación: ${usuarioActual.sector}`;
        document.getElementById('subtitulo-centro-mando').textContent = 'Análisis de tu equipo de campo.';
    } else if (usuarioActual.rol === 'director') {
        if (sectorFiltro !== 'Todos') {
            bdFiltrada = bdFiltrada.filter(r => r.sectorNombre === sectorFiltro);
        }
        document.getElementById('titulo-centro-mando').innerHTML = `<i class="fa-solid fa-crown text-amber-500 mr-2"></i>Centro de Mando Gerencial`;
        document.getElementById('subtitulo-centro-mando').textContent = 'Visión global de la respuesta humanitaria.';
    }

    // Cálculos KPIs Rápidos
    const kpiTotalPersonas = bdFiltrada.reduce((acc, curr) => acc + (curr.totalAlcanzado || 0), 0);
    document.getElementById('dash-total-reportes').textContent = bdFiltrada.length;
    document.getElementById('dash-total-personas').textContent = kpiTotalPersonas.toLocaleString();
    
    // Calcular Meta Global (Simulada para KPIs)
    let sumaMetas = 0;
    if(usuarioActual.rol === 'coordinador') {
         Object.keys(metasConfiguradas).forEach(k => {
             if(k.includes(usuarioActual.sector)) sumaMetas += metasConfiguradas[k];
         });
    } else {
         Object.keys(metasConfiguradas).forEach(k => sumaMetas += metasConfiguradas[k]);
    }
    const porcentajeMeta = sumaMetas > 0 ? Math.min(Math.round((kpiTotalPersonas / sumaMetas) * 100), 100) : 0;
    document.getElementById('dash-porcentaje-meta').textContent = porcentajeMeta + '%';

    // Disparar Renderizadores Específicos
    window.humanHubApp.renderizarGraficosPowerBI(bdFiltrada);
    window.humanHubApp.renderizarMetasConfig(bdFiltrada);
    window.humanHubApp.renderizarMatrizBeneficiarios(bdFiltrada);
    window.humanHubApp.renderizarMatrizInsumos(bdFiltrada);
    window.humanHubApp.renderizarMatrizTransversales(bdFiltrada);
};

window.humanHubApp.renderizarGraficosPowerBI = (datos) => {
    // 1. Gráfico Metas (Simulado con Adenda)
    const ctxMetas = document.getElementById('chartMetas').getContext('2d');
    if (chartMetasInstance) chartMetasInstance.destroy();
    
    let labelsMetas = [], dataAlcanzado = [], dataMeta = [];
    indicadoresEditados.forEach(ind => {
        if(usuarioActual.rol === 'director' || ind.sector.toUpperCase() === usuarioActual.sector.toUpperCase()) {
             labelsMetas.push(ind.componente);
             dataMeta.push(ind.meta);
             // Trazabilidad IA simple para gráficos
             let suma = 0;
             datos.forEach(r => { if(r.tema === ind.componente) suma += r.totalAlcanzado; });
             dataAlcanzado.push(suma);
        }
    });

    chartMetasInstance = new Chart(ctxMetas, {
        type: 'bar',
        data: {
            labels: labelsMetas.slice(0, 5), // Mostrar top 5
            datasets: [
                { label: 'Alcanzado', data: dataAlcanzado.slice(0,5), backgroundColor: '#2563eb', borderRadius: 4 },
                { label: 'Meta', data: dataMeta.slice(0,5), backgroundColor: '#cbd5e1', borderRadius: 4 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });

    // 2. Gráfico Aporte (Dona Dinámica según Rol)
    const ctxDoughnut = document.getElementById('chartProfesionales').getContext('2d');
    if (chartProfesionalesInstance) chartProfesionalesInstance.destroy();
    
    const aportesMap = {};
    const tituloDona = document.getElementById('titulo-chart-doughnut');
    
    if (usuarioActual.rol === 'director') {
        tituloDona.innerHTML = '<i class="fa-solid fa-chart-pie text-brand-600 mr-2"></i>Aporte Consolidado por Área Operativa';
        datos.forEach(r => { aportesMap[r.sectorNombre] = (aportesMap[r.sectorNombre] || 0) + r.totalAlcanzado; });
    } else {
        tituloDona.innerHTML = '<i class="fa-solid fa-chart-pie text-brand-600 mr-2"></i>Aporte Individual por Promotor';
        datos.forEach(r => { aportesMap[r.profesionales.split(',')[0]] = (aportesMap[r.profesionales.split(',')[0]] || 0) + r.totalAlcanzado; });
    }

    chartProfesionalesInstance = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: Object.keys(aportesMap),
            datasets: [{ data: Object.values(aportesMap), backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });

    // 3. Gráfico Demografía (Ahora Columnas Verticales)
    const ctxDemo = document.getElementById('chartDemografia').getContext('2d');
    if (chartDemoInstance) chartDemoInstance.destroy();
    
    let sumNinos = 0, sumAdultos = 0;
    datos.forEach(r => {
        r.poblacion.forEach(p => {
             const t = p.f_nor + p.f_r + p.m_nor + p.m_r;
             if(p.grupo.includes('meses') || (p.grupo.includes('año') && parseInt(p.grupo) < 18)) sumNinos += t;
             else sumAdultos += t;
        });
    });

    chartDemoInstance = new Chart(ctxDemo, {
        type: 'bar', // Cambiado a vertical
        data: {
            labels: ['NNA (<18)', 'Adultos (18+)'],
            datasets: [{ label: 'Personas', data: [sumNinos, sumAdultos], backgroundColor: ['#059669', '#d97706'], borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
};

window.humanHubApp.renderizarMatrizInsumos = (datos) => {
    const thead = document.getElementById('thead-matriz-insumos');
    const tbody = document.getElementById('tbody-matriz-insumos');
    
    // Obtener lista única de todos los insumos repartidos
    const listaInsumosUnicos = new Set();
    datos.forEach(r => r.insumos.forEach(i => listaInsumosUnicos.add(i.nombre.toUpperCase())));
    const arrayInsumos = Array.from(listaInsumosUnicos).sort();

    // Construir Cabecera (Diseño Tarjeta Visual)
    thead.innerHTML = `
        <tr class="bg-brand-100/50 text-brand-900 border-b border-brand-200">
            <th class="px-4 py-3 font-bold text-left">PERIODO / FECHA</th>
            <th class="px-4 py-3 font-bold">ÁREA</th>
            <th class="px-4 py-3 font-bold">MUNICIPIO</th>
            <th class="px-4 py-3 font-bold">PARROQUIA</th>
            <th class="px-4 py-3 font-bold border-r border-brand-200">PROFESIONAL</th>
            ${arrayInsumos.map(ins => `<th class="px-4 py-3 font-bold bg-emerald-50/50 text-emerald-800 border-r border-emerald-100">${ins}</th>`).join('')}
        </tr>
    `;

    // Construir Filas
    tbody.innerHTML = datos.map(r => {
        // Mapear cantidades por insumo
        const celdasInsumos = arrayInsumos.map(nombreIns => {
            const insumoEncontrado = r.insumos.find(i => i.nombre.toUpperCase() === nombreIns);
            const cant = insumoEncontrado ? insumoEncontrado.cantidad : 0;
            return `<td class="px-4 py-3 border-r border-slate-100 ${cant > 0 ? 'font-bold text-emerald-600 bg-emerald-50/30' : 'text-slate-300'}">${cant}</td>`;
        }).join('');

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-left font-medium">${r.fecha}</td>
                <td class="px-4 py-3 font-bold text-brand-700">${r.sectorNombre.toUpperCase()}</td>
                <td class="px-4 py-3">${r.municipio}</td>
                <td class="px-4 py-3">${r.parroquia}</td>
                <td class="px-4 py-3 border-r border-slate-200 text-slate-500">${r.profesionales}</td>
                ${celdasInsumos}
            </tr>
        `;
    }).join('');
};

window.humanHubApp.renderizarMatrizBeneficiarios = (datos) => {
    const thead = document.getElementById('thead-matriz-beneficiarios');
    const tbody = document.getElementById('tbody-matriz-beneficiarios');
    
    // Diseño del clon exacto del Excel Kobo (Grupos Etarios)
    const gruposGenerales = ['0 A 17 AÑOS', '18 A 59 AÑOS', '60 AÑOS O MÁS'];
    
    thead.innerHTML = `
        <tr class="bg-slate-200 text-slate-800 border-b border-slate-300">
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300 text-left">MES</th>
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300">ESTADO</th>
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300">MUNICIPIO</th>
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300">PARROQUIA</th>
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300">ESTABLECIMIENTO</th>
            <th rowspan="2" class="px-4 py-2 border-r border-slate-300 text-[10px] w-24 leading-tight bg-slate-300">Actividad con beneficiarios recurrentes</th>
            ${gruposGenerales.map(g => `<th colspan="2" class="px-4 py-2 border-r border-slate-300 bg-blue-100 text-blue-900">${g}</th>`).join('')}
            <th rowspan="2" class="px-4 py-2 bg-slate-300 font-black">Total</th>
        </tr>
        <tr class="bg-slate-100 text-[9px] font-bold text-slate-600">
            ${gruposGenerales.map(() => `<th class="px-2 py-1 border-r border-slate-300 text-pink-600">Femenino</th><th class="px-2 py-1 border-r border-slate-300 text-blue-600">Masculino</th>`).join('')}
        </tr>
    `;

    tbody.innerHTML = datos.map(r => {
        const mesStr = new Date(r.fecha).toLocaleString('es-ES', { month: 'long' }).toUpperCase();
        
        // Agrupar la matemática para No Recurrentes (nor) y Recurrentes (r)
        let matrix = { nor: { f: [0,0,0], m: [0,0,0], total: 0 }, r: { f: [0,0,0], m: [0,0,0], total: 0 } };
        
        r.poblacion.forEach(p => {
             // Mapeo simple de edad a los 3 grupos grandes para demostración
             let indiceGrupo = 1; // 18-59 por defecto
             if(p.grupo.includes('meses') || parseInt(p.grupo) < 18) indiceGrupo = 0;
             else if(parseInt(p.grupo) >= 60) indiceGrupo = 2;

             matrix.nor.f[indiceGrupo] += p.f_nor; matrix.nor.m[indiceGrupo] += p.m_nor;
             matrix.r.f[indiceGrupo] += p.f_r; matrix.r.m[indiceGrupo] += p.m_r;
             
             matrix.nor.total += (p.f_nor + p.m_nor);
             matrix.r.total += (p.f_r + p.m_r);
        });

        // Retornar las DOS filas por cada comunidad (Rowspan mágico)
        return `
            <!-- Fila NO Recurrente -->
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td rowspan="2" class="px-4 py-2 border-r border-slate-200 text-left font-bold bg-white">${mesStr}</td>
                <td rowspan="2" class="px-4 py-2 border-r border-slate-200 bg-white">${r.estado}</td>
                <td rowspan="2" class="px-4 py-2 border-r border-slate-200 bg-white">${r.municipio}</td>
                <td rowspan="2" class="px-4 py-2 border-r border-slate-200 bg-white">${r.parroquia}</td>
                <td rowspan="2" class="px-4 py-2 border-r border-slate-200 bg-white font-medium text-slate-800 truncate max-w-[150px]" title="${r.comunidad}">${r.comunidad}</td>
                <td class="px-2 py-1 border-r border-slate-200 text-slate-500 border-b border-dashed">No</td>
                ${matrix.nor.f.map((v, i) => `<td class="px-2 py-1 border-r border-slate-100 border-b border-dashed">${v}</td><td class="px-2 py-1 border-r border-slate-200 border-b border-dashed">${matrix.nor.m[i]}</td>`).join('')}
                <td class="px-4 py-1 font-bold text-slate-800 bg-slate-50 border-b border-dashed">${matrix.nor.total}</td>
            </tr>
            <!-- Fila SÍ Recurrente -->
            <tr class="hover:bg-slate-50 border-b border-slate-300 bg-slate-50/30">
                <td class="px-2 py-1 border-r border-slate-200 text-slate-500">Sí</td>
                ${matrix.r.f.map((v, i) => `<td class="px-2 py-1 border-r border-slate-100">${v}</td><td class="px-2 py-1 border-r border-slate-200">${matrix.r.m[i]}</td>`).join('')}
                <td class="px-4 py-1 font-bold text-slate-800 bg-slate-100">${matrix.r.total}</td>
            </tr>
        `;
    }).join('');
};

window.humanHubApp.renderizarMatrizTransversales = (datos) => {
    const tbody = document.getElementById('tbody-matriz-transversales');
    tbody.innerHTML = datos.map(r => {
        const tr = r.transversales || { gen:{}, aap:{info:{}, decisiones:{}}, peas:{sensibilizacion:{}, riesgo:{}, consultas:{}}, pqr:{} };
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-2 border-r font-medium text-left">${r.fecha}</td>
                <td class="px-4 py-2 border-r font-bold text-slate-600">${r.sectorNombre.toUpperCase()}</td>
                
                <td class="px-2 py-2 border-r">${tr.gen?.activo ? 'Sí' : 'No'}</td>
                <td class="px-2 py-2 border-r text-purple-700">${(tr.gen?.ninas || 0) + (tr.gen?.ninos || 0)}</td>
                <td class="px-2 py-2 border-r text-purple-700">${(tr.gen?.mujeres || 0) + (tr.gen?.hombres || 0)}</td>
                
                <td class="px-2 py-2 border-r text-blue-700">${(tr.aap?.info?.mujeres || 0) + (tr.aap?.info?.hombres || 0)}</td>
                <td class="px-2 py-2 border-r text-blue-700">${(tr.aap?.decisiones?.mujeres || 0) + (tr.aap?.decisiones?.hombres || 0)}</td>
                
                <td class="px-2 py-2 border-r text-pink-700">${(tr.peas?.sensibilizacion?.mujeres || 0) + (tr.peas?.sensibilizacion?.hombres || 0)}</td>
                <td class="px-2 py-2 border-r text-pink-700">${(tr.peas?.riesgo?.mujeres || 0) + (tr.peas?.riesgo?.hombres || 0)}</td>
                <td class="px-2 py-2 border-r text-pink-700">${(tr.peas?.consultas?.mujeres || 0) + (tr.peas?.consultas?.hombres || 0)}</td>
                
                <td class="px-2 py-2 border-r text-amber-700">${tr.pqr?.info || 0}</td>
                <td class="px-2 py-2 border-r text-amber-700">${tr.pqr?.asistencia || 0}</td>
                <td class="px-2 py-2 border-r text-amber-700">${tr.pqr?.buzon || 0}</td>
                <td class="px-2 py-2 font-bold text-red-600 bg-red-50/50">${tr.pqr?.queja || 0}</td>
            </tr>
        `;
    }).join('');
};

window.humanHubApp.renderizarTablasCualitativas = () => {
    const contenedorCoord = document.getElementById('tabla-coord-container');
    const contenedorCoordEnviados = document.getElementById('tabla-coord-enviados-container');
    const contenedorDir = document.getElementById('tabla-director-container');
    
    // Obtener reportes según rol
    const fechaDesde = new Date(document.getElementById('dash-desde').value);
    const fechaHasta = new Date(document.getElementById('dash-hasta').value);
    let misReportesBD = dataSimuladaBD.filter(r => new Date(r.fecha) >= fechaDesde && new Date(r.fecha) <= fechaHasta);

    if (usuarioActual.rol === 'coordinador') {
        // VISTA COORDINADOR
        misReportesBD = misReportesBD.filter(r => r.sectorNombre.toLowerCase() === usuarioActual.sector.toLowerCase());
        
        contenedorCoord.classList.remove('hidden');
        contenedorCoordEnviados.classList.remove('hidden');
        contenedorDir.classList.add('hidden');
        document.getElementById('titulo-tabla-cualitativa').innerHTML = '<i class="fa-solid fa-users text-brand-600 mr-2"></i>Auditoría de tu Equipo de Campo';
        document.getElementById('sub-tabla-cualitativa').textContent = 'Revisa las actividades registradas por tus promotores.';

        // Llenar tabla de promotores
        document.getElementById('tabla-audit-profesionales').innerHTML = misReportesBD.map(r => `
            <tr class="hover:bg-slate-50 border-b border-slate-100">
                <td class="px-6 py-4 font-medium text-slate-800">
                    <p>${r.profesionales}</p>
                    <p class="text-xs text-slate-400 font-normal">${r.fecha} | ${r.comunidad}</p>
                </td>
                <td class="px-6 py-4 text-center"><span class="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">1 Actividad</span></td>
                <td class="px-6 py-4 text-center font-bold text-emerald-600">${r.totalAlcanzado}</td>
                <td class="px-6 py-4 text-center"><button onclick="window.humanHubApp.showToast('Descargando PDF original...')" class="text-brand-600 hover:text-brand-800 p-2"><i class="fa-solid fa-file-pdf text-xl"></i></button></td>
            </tr>
        `).join('') || `<tr><td colspan="4" class="text-center py-6 text-slate-500">No hay reportes de campo en este periodo.</td></tr>`;

        // Llenar tabla de Enviados a Dirección
        const misEnviados = informesEnviadosDireccion.filter(inf => inf.sector.toLowerCase() === usuarioActual.sector.toLowerCase());
        document.getElementById('tabla-mis-enviados').innerHTML = misEnviados.map(inf => `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-bold text-slate-700">${inf.id}</td>
                <td class="px-6 py-4">${inf.fechaEnvio}</td>
                <td class="px-6 py-4 text-center"><button class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition"><i class="fa-solid fa-download mr-1"></i> Copia Local</button></td>
            </tr>
        `).join('') || `<tr><td colspan="3" class="text-center py-6 text-slate-500">Aún no has enviado informes oficiales a Dirección.</td></tr>`;

    } else if (usuarioActual.rol === 'director') {
        // VISTA DIRECTOR (Bandeja de Entrada Oficial)
        contenedorCoord.classList.add('hidden');
        contenedorCoordEnviados.classList.add('hidden');
        contenedorDir.classList.remove('hidden');
        document.getElementById('seccion-ia-gerencial').classList.add('hidden'); // Director no redacta, solo lee aquí
        
        document.getElementById('titulo-tabla-cualitativa').innerHTML = '<i class="fa-solid fa-inbox text-amber-600 mr-2"></i>Bandeja de Entrada Oficial (Informes de Coordinadores)';
        document.getElementById('sub-tabla-cualitativa').textContent = 'Descarga los informes consolidados mensuales enviados por cada área.';

        document.getElementById('tabla-bandeja-director').innerHTML = informesEnviadosDireccion.map(inf => `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-medium">${inf.fechaEnvio}</td>
                <td class="px-6 py-4 font-bold text-brand-700">${inf.sector.toUpperCase()}</td>
                <td class="px-6 py-4">${inf.autor}</td>
                <td class="px-6 py-4 text-center"><button class="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm"><i class="fa-solid fa-file-pdf mr-2"></i> Reporte Oficial</button></td>
            </tr>
        `).join('') || `<tr><td colspan="4" class="text-center py-8 text-slate-500">No hay informes recibidos en la bandeja.</td></tr>`;
    }
    
    // Llenar tabla global de Últimos Informes (Consolidación Inteligente para Director)
    const tbodyUltimos = document.getElementById('tbody-ultimos-informes');
    if (usuarioActual.rol === 'director') {
        // Lógica de Consolidación: Agrupar por Sector y Mes
        const consolidados = {};
        misReportesBD.forEach(r => {
            const mes = r.fecha.substring(0, 7); // YYYY-MM
            const clave = `${r.sectorNombre}-${mes}`;
            if(!consolidados[clave]) {
                consolidados[clave] = { sector: r.sectorNombre, periodo: mes, total: 0, coordinadores: new Set() };
            }
            consolidados[clave].total += r.totalAlcanzado;
            // Simulamos obtener el coordinador a cargo del sector
            const coordArea = Object.values(rolesPermitidos).find(rol => rol.rol === 'coordinador' && rol.sector.toLowerCase() === r.sectorNombre.toLowerCase());
            if(coordArea) consolidados[clave].coordinadores.add(coordArea.label);
        });

        tbodyUltimos.innerHTML = Object.values(consolidados).map(c => `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-medium text-slate-800">Consolidado Mensual (${c.periodo})</td>
                <td class="px-6 py-4 font-bold text-brand-700">${c.sector.toUpperCase()}</td>
                <td class="px-6 py-4 text-slate-500 text-xs truncate max-w-xs">Agrupación de todas las actividades del mes.</td>
                <td class="px-6 py-4 text-slate-600">${Array.from(c.coordinadores).join(', ')}</td>
                <td class="px-6 py-4 text-center font-bold text-brand-900">${c.total.toLocaleString()} personas</td>
            </tr>
        `).join('') || `<tr><td colspan="5" class="text-center py-4">No hay datos consolidados.</td></tr>`;
    } else {
        // Coordinador ve los crudos
        tbodyUltimos.innerHTML = misReportesBD.slice(0,10).map(r => `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-medium text-slate-800">${r.periodo} (${r.fecha})</td>
                <td class="px-6 py-4 font-bold text-brand-700">${r.sectorNombre.toUpperCase()}</td>
                <td class="px-6 py-4 text-slate-500 text-xs truncate max-w-xs">${r.actividad} / ${r.tema}</td>
                <td class="px-6 py-4 text-slate-600">${r.profesionales}</td>
                <td class="px-6 py-4 text-center font-bold text-brand-900">${r.totalAlcanzado}</td>
            </tr>
        `).join('') || `<tr><td colspan="5" class="text-center py-4">Sin registros.</td></tr>`;
    }
};

window.humanHubApp.validarTextoInforme = () => {
    const texto = document.getElementById('caja-resultado-ia-gerencial').value;
    const btnEnviar = document.getElementById('btn-ia-enviar');
    if(texto.length > 20) {
        btnEnviar.classList.remove('hidden');
    } else {
        btnEnviar.classList.add('hidden');
    }
};

window.humanHubApp.generarResumenGerencialIA = (tipo) => {
    const caja = document.getElementById('caja-resultado-ia-gerencial');
    caja.value = "Conectando con Gemini 1.5 Pro...\nAnalizando matrices cualitativas de campo...";
    caja.disabled = true;

    setTimeout(() => {
        const sector = usuarioActual.sector || 'Todos';
        const txtSintesis = `SÍNTESIS GERENCIAL (${sector})\n\nDurante el periodo evaluado, las intervenciones mantuvieron un nivel de receptividad Excelente. El equipo logró superar nudos críticos logísticos, garantizando la entrega oportuna de insumos y la participación comunitaria. Se destacó el cumplimiento en enfoques transversales de protección.`;
        const txtIntegral = `INFORME INTEGRAL DE COORDINACIÓN - ${sector.toUpperCase()}\n\n1. CONTEXTO OPERATIVO\nLas actividades del mes se desarrollaron superando desafíos climáticos y logísticos. La receptividad general fue catalogada como 'Buena a Excelente'.\n\n2. LOGROS DESTACADOS\n- Cobertura sostenida en comunidades vulnerables.\n- Integración efectiva de charlas PEAS.\n\n3. DESAFÍOS Y RECOMENDACIONES\nSe requiere mayor stock de insumos tipo 2 para el próximo trimestre.`;

        caja.value = tipo === 'sintesis' ? txtSintesis : txtIntegral;
        caja.disabled = false;
        window.humanHubApp.validarTextoInforme();
        window.humanHubApp.showToast('Borrador generado. Puedes editarlo antes de enviarlo.');
    }, 2000);
};

window.humanHubApp.enviarInformeADireccion = () => {
    const texto = document.getElementById('caja-resultado-ia-gerencial').value;
    const firma = document.getElementById('perfil-nombre').value || usuarioActual.label;
    
    if(!texto || texto.length < 20) return window.humanHubApp.showToast('El informe está vacío.', 'error');
    
    const nuevoInforme = {
        id: 'INF-' + Date.now().toString().slice(-4),
        fechaEnvio: new Date().toISOString().split('T')[0],
        sector: usuarioActual.sector,
        autor: firma,
        contenido: texto
    };
    
    informesEnviadosDireccion.push(nuevoInforme);
    localStorage.setItem('humanhub_informes_oficiales', JSON.stringify(informesEnviadosDireccion));
    
    document.getElementById('caja-resultado-ia-gerencial').value = '';
    window.humanHubApp.validarTextoInforme();
    window.humanHubApp.showToast('¡Informe Oficial Enviado a la Dirección General!');
    window.humanHubApp.renderizarTablasCualitativas(); // Refrescar tablas
};

window.humanHubApp.exportarMatrizInsumosExcel = () => {
    let html = document.getElementById('tabla-matriz-insumos').outerHTML;
    window.humanHubApp.descargarExcel(html, 'Matriz_Insumos_FUNDAINIL');
};
window.humanHubApp.exportarMatrizBeneficiariosExcel = () => {
    let html = document.getElementById('tabla-matriz-beneficiarios').outerHTML;
    window.humanHubApp.descargarExcel(html, 'Matriz_Beneficiarios_5W');
};
window.humanHubApp.exportarTransversalesExcel = () => {
    let html = document.getElementById('tabla-matriz-transversales').outerHTML;
    window.humanHubApp.descargarExcel(html, 'Matriz_Transversales_PQR');
};
window.humanHubApp.descargarExcel = (htmlTable, filename) => {
    const uri = 'data:application/vnd.ms-excel;base64,';
    const template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';
    const base64 = function(s) { return window.btoa(unescape(encodeURIComponent(s))) };
    const format = function(s, c) { return s.replace(/{(\w+)}/g, function(m, p) { return c[p]; }) };
    const ctx = { worksheet: 'Reporte', table: htmlTable };
    const link = document.createElement("a");
    link.download = filename + ".xls";
    link.href = uri + base64(format(template, ctx));
    link.click();
};

window.humanHubApp.guardarPerfil = () => {
    const nombre = document.getElementById('perfil-nombre').value;
    perfilUsuario.nombre = nombre;
    localStorage.setItem('humanhub_perfil', JSON.stringify(perfilUsuario));
    window.humanHubApp.showToast('Perfil actualizado correctamente.');
};