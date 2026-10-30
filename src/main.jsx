import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  Box,
  Camera,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileImage,
  Film,
  Grid3X3,
  ImagePlus,
  Layers,
  LayoutGrid,
  Move3D,
  Palette,
  Play,
  Plus,
  Rotate3D,
  RotateCcw,
  Ruler,
  Save,
  Scissors,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import ThreeViewport from './ThreeViewport.jsx';
import CinematicPlayer from './CinematicPlayer.jsx';
import './styles.css';

const WOOD_STYLES = [
  { id: 'ruby', name: 'ياقوتي ملكي', color: '#821429', stripe: '#fdeeed', striped: true },
  { id: 'wine', name: 'عنابي مخملي', color: '#520d1c', stripe: '#f6d5da', striped: true },
  { id: 'walnut', name: 'جوز دافئ', color: '#72503c', stripe: '#d8bd96', striped: false },
  { id: 'black', name: 'أسود كربوني', color: '#1a1c20', stripe: '#e8c992', striped: true },
  { id: 'ivory', name: 'عاجي أوف وايت', color: '#e6ded3', stripe: '#8c2438', striped: false },
  { id: 'gold', name: 'شامبين كلاسيك', color: '#bfa168', stripe: '#fff9ea', striped: true },
];

const WOOD_SWATCHES = [
  '#821429', '#520d1c', '#a61c37', '#72503c', '#1a1c20', '#e6ded3',
  '#bfa168', '#42281d', '#962b43', '#c98a58', '#f7f2ea', '#2e111a',
];

const WALL_SWATCHES = [
  '#f3eee7', '#ebe4db', '#d9cfc5', '#2a0e16', '#3b121e', '#1e1c22', '#e5dfd5', '#16080d',
];

function makeId() {
  return `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createFrame(index, x = 0, y = 0) {
  return {
    id: makeId(),
    name: `برواز ${index}`,
    outerW: 80, // الطول (أفقي ↔)
    outerH: 60, // العرض (رأسي ↕)
    innerW: 62, // طول الفتحة الداخلية
    innerH: 42, // عرض الفتحة الداخلية
    thickness: 2.8,
    style: 'ruby',
    woodColor: '#821429',
    finish: 'satin',
    pinstripe: true,
    pinstripeColor: '#fdeeed',
    matEnabled: true,
    matW: 60,
    matH: 40,
    matBorder: 2.4,
    matColor: '#f7f2ea',
    glassTint: '#fbf4f6',
    glassStrength: 14,
    imageData: '', // نظيف تماماً بدون أي أمثلة لصور أشخاص أو رسوم
    imageName: '',
    imageRotation: 0,
    imageFlip: false,
    x,
    y,
    // أدوات المصمم للتحكم في مكونات البرواز
    showWood: true,
    showGlass: true,
    showMat: true,
    showArtwork: true,
    showBackboard: true,
    showHardware: true,
    showSplines: true,
    showCornerBrackets: false,
    showDustSeal: false,
  };
}

function openProjectDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB غير متاح'));
      return;
    }
    const request = window.indexedDB.open('brwaaz-studio-v2', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('projects')) {
        request.result.createObjectStore('projects');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDraft() {
  try {
    const db = await openProjectDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readonly').objectStore('projects').get('draft');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeDraft(project) {
  try {
    const db = await openProjectDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction('projects', 'readwrite').objectStore('projects').put(project, 'draft');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {}
}

function saveData(name, data, type = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function NumberField({ label, value, min = 1, max = 300, step = 1, suffix = 'سم', onCommit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="number-field">
      <span className="field-label">{label}</span>
      <span className="number-input-wrap" dir="ltr">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
            setDraft(String(next));
            onCommit(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <span className="number-suffix">{suffix}</span>
      </span>
    </label>
  );
}

function ColorControl({ label, value, onChange }) {
  return (
    <div className="color-control">
      <span className="field-label">{label}</span>
      <label className="color-well" title={`${label}: ${value}`}>
        <span className="color-swatch" style={{ background: value }} />
        <span className="color-hex" dir="ltr">{value.toUpperCase()}</span>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
      </label>
    </div>
  );
}

function Section({ icon: Icon, title, note, children, initialOpen = true }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <section className={`control-section ${open ? 'is-open' : ''}`}>
      <button className="section-heading" onClick={() => setOpen((current) => !current)} type="button">
        <span className="section-heading-main">
          <span className="section-icon"><Icon size={16} strokeWidth={1.8} /></span>
          <span>
            <b>{title}</b>
            {note && <small>{note}</small>}
          </span>
        </span>
        <ChevronDown size={15} className="section-chevron" />
      </button>
      {open && <div className="section-content">{children}</div>}
    </section>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="toast"><span className="toast-check"><Check size={14} /></span>{message}</div>
  );
}

function App() {
  const firstFrame = useMemo(() => createFrame(1), []);
  const [frames, setFrames] = useState([firstFrame]);
  const [selectedId, setSelectedId] = useState(firstFrame.id);
  const [background, setBackground] = useState('#f3eee7');
  const [explode, setExplode] = useState(0);
  const [explodeMode, setExplodeMode] = useState('radial');
  const [isolatePart, setIsolatePart] = useState('all');
  const [arrangeMode, setArrangeMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [panelTab, setPanelTab] = useState('design');
  const [toast, setToast] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [showCinematic, setShowCinematic] = useState(false);

  const apiRef = useRef({});
  const projectFileRef = useRef(null);
  const imageFileRef = useRef(null);

  const selected = frames.find((frame) => frame.id === selectedId) || frames[0];

  useEffect(() => {
    let active = true;
    readDraft()
      .then((draft) => {
        if (!active) return;
        if (draft?.frames?.length) {
          setFrames(draft.frames);
          setSelectedId(draft.selectedId || draft.frames[0].id);
          setBackground(draft.background || '#f3eee7');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return undefined;
    const timer = window.setTimeout(() => {
      writeDraft({ frames, selectedId, background }).catch(() => {});
    }, 550);
    return () => window.clearTimeout(timer);
  }, [frames, selectedId, background, draftReady]);

  const updateFrame = useCallback((id, patch) => {
    setFrames((current) => current.map((frame) => {
      if (frame.id !== id) return frame;
      const next = { ...frame, ...patch };
      next.outerW = Math.max(Number(next.outerW) || 1, 2);
      next.outerH = Math.max(Number(next.outerH) || 1, 2);
      next.innerW = clamp(Number(next.innerW) || 1, 1, next.outerW - 1);
      next.innerH = clamp(Number(next.innerH) || 1, 1, next.outerH - 1);
      next.matW = clamp(Number(next.matW) || 1, 1, next.innerW);
      next.matH = clamp(Number(next.matH) || 1, 1, next.innerH);
      next.thickness = clamp(Number(next.thickness) || 0.8, 0.8, 12);
      next.matBorder = clamp(Number(next.matBorder) || 0.2, 0.2, Math.max(0.2, Math.min(next.matW, next.matH) / 2 - 0.1));
      return next;
    }));
  }, []);

  const setPosition = useCallback((id, x, y) => {
    setFrames((current) => current.map((frame) => frame.id === id ? { ...frame, x, y } : frame));
  }, []);

  const addFrame = () => {
    const next = createFrame(frames.length + 1);
    const leftmost = frames.reduce((min, frame) => Math.min(min, Number(frame.x || 0) - Number(frame.outerW || 80) / 200), Infinity);
    const rightmost = frames.reduce((max, frame) => Math.max(max, Number(frame.x || 0) + Number(frame.outerW || 80) / 200), -Infinity);
    if (frames.length % 2 === 1) next.x = rightmost + next.outerW / 200 + 0.12;
    else next.x = leftmost - next.outerW / 200 - 0.12;
    next.y = 0;
    setFrames((current) => [...current, next]);
    setSelectedId(next.id);
    setPanelTab('design');
  };

  const duplicateFrame = () => {
    if (!selected) return;
    const next = {
      ...selected,
      id: makeId(),
      name: `${selected.name} — نسخة`,
      x: (selected.x || 0) + 0.12,
      y: (selected.y || 0) - 0.12,
    };
    setFrames((current) => [...current, next]);
    setSelectedId(next.id);
  };

  const removeFrame = (id) => {
    if (frames.length <= 1) {
      setToast('لا يمكن حذف البرواز الأخير، يجب بقاء برواز واحد على الأقل');
      return;
    }
    const next = frames.filter((frame) => frame.id !== id);
    setFrames(next);
    if (id === selectedId) setSelectedId(next[0].id);
  };

  const arrangeFrames = (direction) => {
    const gap = 0.14;
    const ordered = [...frames];
    if (direction === 'horizontal') {
      const total = ordered.reduce((sum, frame) => sum + frame.outerW / 100, 0) + gap * (ordered.length - 1);
      let x = -total / 2;
      for (const frame of ordered) {
        const width = frame.outerW / 100;
        setPosition(frame.id, x + width / 2, 0);
        x += width + gap;
      }
    } else if (direction === 'vertical') {
      const total = ordered.reduce((sum, frame) => sum + frame.outerH / 100, 0) + gap * (ordered.length - 1);
      let y = total / 2;
      for (const frame of ordered) {
        const height = frame.outerH / 100;
        setPosition(frame.id, 0, y - height / 2);
        y -= height + gap;
      }
    } else {
      const cols = Math.ceil(Math.sqrt(ordered.length));
      const rows = Math.ceil(ordered.length / cols);
      ordered.forEach((frame, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        setPosition(frame.id, (col - (cols - 1) / 2) * 0.85, ((rows - 1) / 2 - row) * 0.95);
      });
    }
    window.setTimeout(() => apiRef.current.fit?.(), 20);
  };

  const loadImage = (file) => {
    if (!file || !selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateFrame(selected.id, { imageData: String(reader.result), imageName: file.name });
      setToast(`تم إدراج الصورة (${file.name}) داخل البرواز`);
    };
    reader.onerror = () => setToast('تعذّر قراءة الصورة، جرّب ملفًا آخر');
    reader.readAsDataURL(file);
  };

  const saveProject = () => {
    const project = {
      app: 'BRWAAZ',
      version: 2,
      savedAt: new Date().toISOString(),
      frames,
      selectedId,
      background,
    };
    saveData('مشروع-BRWAAZ.brwaaz.json', JSON.stringify(project, null, 2));
    setToast('اتحفظ مشروع BRWAAZ بكل المقاسات والمواصفات');
  };

  const openProject = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result));
        if (!Array.isArray(project.frames) || !project.frames.length) throw new Error('invalid project');
        setFrames(project.frames);
        setSelectedId(project.selectedId || project.frames[0].id);
        setBackground(project.background || '#f3eee7');
        setExplode(0);
        setToast('تم فتح مشروع BRWAAZ بنجاح');
      } catch {
        setToast('ملف المشروع غير صالح');
      }
    };
    reader.readAsText(file);
  };

  const exportCutList = () => {
    if (!selected) return;
    const f = selected;
    const matW = Math.min(f.matW, f.innerW);
    const matH = Math.min(f.matH, f.innerH);
    const matBorder = f.matEnabled && f.showMat !== false ? f.matBorder : 0;
    const pictureW = f.matEnabled && f.showMat !== false ? matW - 2 * matBorder : f.innerW;
    const pictureH = f.matEnabled && f.showMat !== false ? matH - 2 * matBorder : f.innerH;

    const rows = [
      ['القطعة', 'العدد', 'الطول (سم)', 'العرض (سم)', 'السماكة (سم)', 'ملاحظات للنجار'],
      ...(f.showWood !== false ? [
        ['عارضة أفقية خشب', '2', f.outerW, ((f.outerH - f.innerH) / 2).toFixed(1), f.thickness, 'قص مِيتَر 45° عند الطرفين'],
        ['قائم رأسي خشب', '2', f.outerH, ((f.outerW - f.innerW) / 2).toFixed(1), f.thickness, 'قص مِيتَر 45° عند الطرفين'],
      ] : []),
      ...(f.showBackboard !== false ? [
        ['لوح ظهر MDF', '1', (f.outerW - 0.8).toFixed(1), (f.outerH - 0.8).toFixed(1), '0.55', 'يُثبّت من الخلف بعد تركيب العمل'],
      ] : []),
      ...(f.showGlass !== false ? [
        ['لوح الزجاج المصقول', '1', f.innerW, f.innerH, '0.3', 'حواف مصقولة؛ يدخل خلف شفة البرواز'],
      ] : []),
      ...(f.matEnabled && f.showMat !== false ? [
        ['باسبارتو مشطوف', '1', matW, matH, '0.15', `فتحة الصورة الداخلية ${pictureW.toFixed(1)} × ${pictureH.toFixed(1)} سم`],
      ] : []),
      ...(f.showArtwork !== false ? [
        ['العمل الفني / الصورة', '1', pictureW.toFixed(1), pictureH.toFixed(1), '—', 'طباعة فوتوغرافية أو كانفاس'],
      ] : []),
      ...(f.showSplines !== false ? [
        ['لسان خشبي لتقوية المِيتَر', '4', '3.5', '0.8', '0.3', 'لسان خشبي لتقوية زوايا الـ 45°'],
      ] : []),
      ...(f.showHardware !== false ? [
        ['حلقات تعليق نحاسية + مسامير', '2', '—', '—', '—', 'تثبيت متوازن على الثلث العلوي للظهر'],
        ['مصدّات حماية مطاطية', '4', '—', '—', '—', 'للحفاظ على مسافة تهوية من الحائط'],
      ] : []),
      ...(f.showCornerBrackets ? [
        ['زوايا نحاسية زخرفية', '4', '4.5', '4.5', '0.2', 'تثبيت خارجي أنيق على زوايا الوجه'],
      ] : []),
      ...(f.showDustSeal ? [
        ['شريط حماية كرافت خلفي', '1', '—', '—', '—', 'إحكام ظهر البرواز ضد الغبار والرطوبة'],
      ] : []),
    ];

    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    saveData(`${f.name.replaceAll(' ', '-')}-قائمة-قص-BRWAAZ.csv`, csv, 'text/csv;charset=utf-8');
    setToast('تم تنزيل قائمة القص والمواد المحدثة للنجار');
  };

  const frameCountLabel = `${String(frames.length).padStart(2, '0')} ${frames.length === 1 ? 'برواز' : 'براويز'}`;

  return (
    <div className="app-shell" dir="rtl">
      {/* Header */}
      <header className="app-header">
        <div className="brand-block">
          <div className="brand-mark"><span className="brand-mark-inner" /></div>
          <div className="brand-copy">
            <strong>BRWAAZ</strong>
            <span>استوديو تصميم البراويز 3D</span>
          </div>
        </div>

        <div className="header-divider" />
        <div className="project-title">
          <span className="project-title-label">مساحة العمل</span>
          <span className="project-title-name">تكوين جداري <i className="saved-dot" /></span>
        </div>
        <span className="header-pill"><span /> حفظ تلقائي</span>

        <div className="header-actions">
          {/* 3D Cinematic Player Button */}
          <button
            className="button button-cinematic"
            onClick={() => setShowCinematic(true)}
            title="مشغل 3D سينمائي تفاعلي لتفكيك وتجميع البرواز بالفيديو كامل الشاشة"
          >
            <Play size={15} fill="currentColor" />
            <span>مشغل 3D سينمائي</span>
          </button>

          <input
            ref={projectFileRef}
            className="visually-hidden"
            type="file"
            accept=".json,.kadr.json,.brwaaz.json,application/json"
            onChange={(e) => { openProject(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button className="button button-quiet" onClick={() => projectFileRef.current?.click()} title="فتح مشروع محفوظ">
            <Upload size={15} /><span>فتح مشروع</span>
          </button>
          <button className="button button-primary" onClick={saveProject} title="حفظ ملف المشروع">
            <Save size={15} /><span>حفظ المشروع</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="workspace-layout">
        {/* Stage Viewport */}
        <main className="stage-column">
          <div className="stage-toolbar">
            <div className="stage-context">
              <div className="context-icon"><LayoutGrid size={17} /></div>
              <div>
                <strong>التكوين الجداري</strong>
                <span>{frameCountLabel} <i /> {!arrangeMode ? 'استعراض 3D مجسم (دوران كامل)' : 'ترتيب وتغيير المواضع'}</span>
              </div>
            </div>

            <div className="stage-tools">
              <button
                className="button button-cinematic"
                style={{ height: '32px', padding: '0 11px', fontSize: '10px' }}
                onClick={() => setShowCinematic(true)}
                title="عرض وتفكيك سينمائي 3D"
              >
                <Film size={14} />
                <span>فيديو 3D تفاعلي</span>
              </button>

              <div className="segmented-control" aria-label="أوضاع مساحة العمل">
                <button
                  className={!arrangeMode ? 'selected' : ''}
                  onClick={() => setArrangeMode(false)}
                  title="دوران ومشاهدة 3D بحرية بالماوس"
                >
                  <Rotate3D size={15} /><span>استعراض 3D (دوران)</span>
                </button>
                <button
                  className={arrangeMode ? 'selected' : ''}
                  onClick={() => setArrangeMode(true)}
                  title="نقل وترتيب مكان البرواز بسحب الماوس"
                >
                  <Move3D size={15} /><span>ترتيب (نقل البرواز)</span>
                </button>
              </div>

              <div className="toolbar-divider" />
              <button
                className={`icon-button ${autoRotate ? 'is-active' : ''}`}
                onClick={() => setAutoRotate((v) => !v)}
                title="دوران تلقائي سلس"
              >
                <RotateCcw size={15} className={autoRotate ? 'spin-icon' : ''} />
              </button>
              <button className="icon-button" onClick={() => apiRef.current.view?.('iso')} title="منظور 3D مائل (مجسم)">
                <Rotate3D size={15} />
              </button>
              <button className="icon-button" onClick={() => apiRef.current.view?.('front')} title="المنظر الأمامي">
                <Box size={15} />
              </button>
              <button className="icon-button" onClick={() => apiRef.current.fit?.()} title="ملاءمة التكوين للشاشة">
                <Sparkles size={15} />
              </button>
              <button className="icon-button" onClick={() => apiRef.current.savePng?.()} title="تصدير لقطة PNG">
                <Camera size={15} />
              </button>
            </div>
          </div>

          <div className={`stage-shell ${arrangeMode ? 'arrange-active' : ''}`}>
            <ThreeViewport
              frames={frames}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMoveFrame={setPosition}
              arrangeMode={arrangeMode}
              explode={explode}
              explodeMode={explodeMode}
              isolatePart={isolatePart}
              background={background}
              autoRotate={autoRotate}
              apiRef={apiRef}
            />

            <div className="stage-top-left glass-chip">
              <span className="live-indicator" />
              <span>{!arrangeMode ? 'وضع استعراض 3D — اسحب بالماوس للتدوير الحر' : 'وضع الترتيب — اسحب البرواز بالماوس لتغيير موضعه'}</span>
            </div>

            <div className="stage-top-right scale-chip">
              <span className="scale-dot" />
              قياس حقيقي <b>1:1</b>
            </div>

            <div className="stage-bottom-left helper-chip">
              {!arrangeMode ? (
                <>
                  <Rotate3D size={14} />
                  <span>اسحب بالماوس للتدوير 360° واستعراض البرواز مجسماً · عجلة الفأرة للتقريب والتكبير</span>
                </>
              ) : (
                <>
                  <Move3D size={14} />
                  <span>اضغط على أي برواز واسحبه بالماوس لتغيير مكانه على الحائط</span>
                </>
              )}
            </div>

            <div className="stage-bottom-right view-cube-wrap">
              <button onClick={() => apiRef.current.view?.('iso')} title="منظور 3D مائل">مائل 3D</button>
              <button onClick={() => apiRef.current.view?.('front')} title="أمام">أمام</button>
              <button onClick={() => apiRef.current.view?.('right')} title="يمين">يمين</button>
              <button onClick={() => apiRef.current.view?.('back')} title="خلف">خلف</button>
            </div>

            {selected && (
              <div className="selection-caption">
                <span className="caption-kicker">العنصر المحدد</span>
                <strong>{selected.name}</strong>
                <span dir="ltr">
                  {selected.outerW} سم (طول) × {selected.outerH} سم (عرض)
                </span>
              </div>
            )}
          </div>

          <div className="stage-footer">
            <div className="footer-left">
              <span className="footer-dot" />
              <span>محرك عرض BRWAAZ 3D</span>
              <span className="footer-separator">/</span>
              <span>تحريك ذكي ومباشر مع حركة الماوس</span>
            </div>
            <button className="stage-footer-action" onClick={() => setPanelTab('details')}>
              <Scissors size={14} />أدوات التفكيك والتصنيع
            </button>
          </div>
        </main>

        {/* Frame Browser (Right Column in RTL) */}
        <aside className="frame-browser">
          <div className="panel-topline">
            <div>
              <span className="eyebrow">مكتبة التكوين</span>
              <h2>براويز الجدار <span>{String(frames.length).padStart(2, '0')}</span></h2>
            </div>
            <button className="icon-button subtle" onClick={addFrame} title="إضافة برواز جديد"><Plus size={17} /></button>
          </div>

          <div className="frame-list">
            {frames.map((frame, index) => (
              <button
                key={frame.id}
                className={`frame-list-card ${frame.id === selectedId ? 'active' : ''}`}
                onClick={() => { setSelectedId(frame.id); setPanelTab('design'); }}
              >
                <span className="frame-mini" style={{ '--mini-color': frame.woodColor }}>
                  <i />
                </span>
                <span className="frame-card-copy">
                  <strong>{frame.name || `برواز ${index + 1}`}</strong>
                  <small dir="ltr">{frame.outerW} × {frame.outerH} cm</small>
                </span>
                <span className="frame-card-index">{String(index + 1).padStart(2, '0')}</span>
              </button>
            ))}
          </div>

          <button className="add-frame-button" onClick={addFrame}><Plus size={16} />إضافة برواز جديد</button>

          <div className="panel-subhead">
            <span>محاذاة وترتيب سريع</span>
            <span className="subhead-line" />
          </div>
          <div className="arrange-grid">
            <button onClick={() => arrangeFrames('horizontal')} title="ترتيب أفقي"><AlignHorizontalSpaceAround size={15} /><span>أفقي</span></button>
            <button onClick={() => arrangeFrames('vertical')} title="ترتيب رأسي"><AlignVerticalSpaceAround size={15} /><span>رأسي</span></button>
            <button onClick={() => arrangeFrames('grid')} title="ترتيب شبكة"><Grid3X3 size={15} /><span>شبكة</span></button>
          </div>

          <div className="browser-tip">
            <span className="tip-bulb"><Move3D size={15} /></span>
            <span>
              <b>حرية التحريك</b>
              <small>ما عليك سوى النقر على أي برواز بالماوس وسحبه فوراً لتغيير موضعه.</small>
            </span>
          </div>

          <div className="panel-stats">
            <span><i className="stats-led" />محرك BRWAAZ نشط</span>
            <span>بيئة 3D تفاعلية</span>
          </div>
        </aside>

        {/* Properties Panel (Left Column in RTL) */}
        <aside className="properties-panel">
          <div className="properties-header">
            <div>
              <span className="eyebrow">لوحة التحكم والتصميم</span>
              <h2>{selected?.name || 'البرواز'}</h2>
            </div>
            <button className="property-menu-button" onClick={duplicateFrame} title="نسخ البرواز"><Copy size={16} /></button>
          </div>

          <div className="property-tabs">
            <button className={panelTab === 'design' ? 'active' : ''} onClick={() => setPanelTab('design')}>
              <Settings2 size={15} />التصميم والخامات
            </button>
            <button className={panelTab === 'details' ? 'active' : ''} onClick={() => setPanelTab('details')}>
              <Scissors size={15} />التفكيك وأدوات المصمم
            </button>
          </div>

          {panelTab === 'design' ? (
            <div className="property-scroll">
              {selected && (
                <>
                  {/* Dimensions Section with FIXED الطول & العرض */}
                  <Section icon={Ruler} title="الأبعاد والمقاسات" note="الطول (أفقي ↔) والعرض (رأسي ↕)">
                    <div className="subsection-label"><span>المقاس الخارجي الكامل (سم)</span><i /></div>
                    <div className="field-grid two-columns">
                      {/* FIXED: الطول is outerW (horizontal) and العرض is outerH (vertical) */}
                      <NumberField
                        label="الطول (أفقي ↔)"
                        value={selected.outerW}
                        min={10}
                        max={240}
                        onCommit={(value) =>
                          updateFrame(selected.id, {
                            outerW: value,
                            innerW: Math.min(selected.innerW, value - 1),
                            matW: Math.min(selected.matW, value - 1),
                          })
                        }
                      />
                      <NumberField
                        label="العرض (رأسي ↕)"
                        value={selected.outerH}
                        min={10}
                        max={240}
                        onCommit={(value) =>
                          updateFrame(selected.id, {
                            outerH: value,
                            innerH: Math.min(selected.innerH, value - 1),
                            matH: Math.min(selected.matH, value - 1),
                          })
                        }
                      />
                    </div>

                    <div className="subsection-label inner-label"><span>مقاس الفتحة الداخلية (سم)</span><i /></div>
                    <div className="field-grid two-columns">
                      <NumberField
                        label="طول الفتحة (↔)"
                        value={selected.innerW}
                        min={5}
                        max={selected.outerW - 1}
                        onCommit={(value) =>
                          updateFrame(selected.id, {
                            innerW: value,
                            matW: Math.min(selected.matW, value),
                          })
                        }
                      />
                      <NumberField
                        label="عرض الفتحة (↕)"
                        value={selected.innerH}
                        min={5}
                        max={selected.outerH - 1}
                        onCommit={(value) =>
                          updateFrame(selected.id, {
                            innerH: value,
                            matH: Math.min(selected.matH, value),
                          })
                        }
                      />
                    </div>

                    <div className="field-grid one-column wood-thickness-field">
                      <NumberField
                        label="سُمك الخشب (عمق البرواز)"
                        value={selected.thickness}
                        min={0.8}
                        max={12}
                        step={0.1}
                        suffix="سم"
                        onCommit={(value) => updateFrame(selected.id, { thickness: value })}
                      />
                    </div>
                    <div className="dimension-summary">
                      <span className="summary-mark"><Ruler size={13} /></span>
                      <span>سُمك وجه الخشب = الفرق بين المقاس الخارجي والداخلي</span>
                    </div>
                  </Section>

                  {/* Colors & Wood Finishes */}
                  <Section icon={Palette} title="الخامة واللون" note="ألوان راقية ولمسات ملكية">
                    <div className="style-grid">
                      {WOOD_STYLES.map((style) => (
                        <button
                          key={style.id}
                          className={`style-swatch ${selected.style === style.id ? 'active' : ''}`}
                          onClick={() =>
                            updateFrame(selected.id, {
                              style: style.id,
                              woodColor: style.color,
                              pinstripeColor: style.stripe,
                              pinstripe: style.striped,
                            })
                          }
                          title={style.name}
                        >
                          <span className="style-color" style={{ background: style.color }}>
                            <i style={{ background: style.striped ? style.stripe : 'transparent' }} />
                          </span>
                          <span>{style.name}</span>
                          {selected.style === style.id && <Check size={12} className="style-check" />}
                        </button>
                      ))}
                    </div>

                    <ColorControl
                      label="درجة لون الخشب المخصص"
                      value={selected.woodColor}
                      onChange={(color) => updateFrame(selected.id, { woodColor: color, style: 'custom' })}
                    />
                    <div className="color-palette" aria-label="ألوان الخشب السريعة">
                      {WOOD_SWATCHES.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateFrame(selected.id, { woodColor: color, style: 'custom' })}
                          style={{ background: color }}
                          title={color}
                        />
                      ))}
                      <label className="palette-more" title="اختيار درجة لون دقيقة">
                        <Plus size={12} />
                        <input
                          type="color"
                          value={selected.woodColor}
                          onChange={(e) => updateFrame(selected.id, { woodColor: e.target.value, style: 'custom' })}
                        />
                      </label>
                    </div>

                    <div className="compact-row finish-row">
                      <span className="field-label">ملمس التشطيب</span>
                      <div className="select-wrap">
                        <select
                          value={selected.finish}
                          onChange={(e) => updateFrame(selected.id, { finish: e.target.value })}
                        >
                          <option value="matte">مطفي مخملي (Matte)</option>
                          <option value="satin">ساتان ناعم (Satin)</option>
                          <option value="gloss">لامع فاخر (Glossy)</option>
                        </select>
                        <ChevronDown size={14} />
                      </div>
                    </div>

                    <label className="toggle-row">
                      <span><b>خطوط تطعيم زخرفية</b><small>حواف رفيعة أنيقة على وجه الخشب</small></span>
                      <input
                        type="checkbox"
                        checked={selected.pinstripe}
                        onChange={(e) => updateFrame(selected.id, { pinstripe: e.target.checked })}
                      />
                      <i className="toggle-track" />
                    </label>
                    {selected.pinstripe && (
                      <ColorControl
                        label="لون خط التطعيم"
                        value={selected.pinstripeColor}
                        onChange={(color) => updateFrame(selected.id, { pinstripeColor: color })}
                      />
                    )}
                  </Section>

                  {/* Mat board */}
                  <Section icon={Layers} title="الباسبارتو الداخلي" note="إطار كارتون مشطوف يحيط بالصورة">
                    <label className="toggle-row mat-toggle">
                      <span><b>إضافة باسبارتو</b><small>حافة مشطوفة حول العمل الفني</small></span>
                      <input
                        type="checkbox"
                        checked={selected.matEnabled}
                        onChange={(e) => updateFrame(selected.id, { matEnabled: e.target.checked, showMat: e.target.checked })}
                      />
                      <i className="toggle-track" />
                    </label>
                    {selected.matEnabled && (
                      <>
                        <div className="field-grid two-columns mat-dimensions">
                          <NumberField
                            label="طول الباسبارتو (↔)"
                            value={selected.matW}
                            min={5}
                            max={selected.innerW}
                            onCommit={(value) => updateFrame(selected.id, { matW: value })}
                          />
                          <NumberField
                            label="عرض الباسبارتو (↕)"
                            value={selected.matH}
                            min={5}
                            max={selected.innerH}
                            onCommit={(value) => updateFrame(selected.id, { matH: value })}
                          />
                          <NumberField
                            label="عرض حافة الشطف"
                            value={selected.matBorder}
                            min={0.2}
                            max={Math.max(0.2, Math.min(selected.matW, selected.matH) / 2 - 0.1)}
                            step={0.1}
                            onCommit={(value) => updateFrame(selected.id, { matBorder: value })}
                          />
                        </div>
                        <ColorControl
                          label="لون الباسبارتو"
                          value={selected.matColor}
                          onChange={(color) => updateFrame(selected.id, { matColor: color })}
                        />
                        <div className="neutral-swatches">
                          {['#f7f2ea', '#ffffff', '#e8dfd5', '#d4c9bc', '#2a1a20', '#bfa168'].map((color) => (
                            <button
                              key={color}
                              style={{ background: color }}
                              className={color.toLowerCase() === selected.matColor.toLowerCase() ? 'active' : ''}
                              onClick={() => updateFrame(selected.id, { matColor: color })}
                              title={color}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </Section>

                  {/* Photo & Glass (strictly NO mock silhouette) */}
                  <Section icon={ImagePlus} title="الصورة والزجاج" note="إدراج صورتك الخاصة بدون أمثلة افتراضية">
                    <input
                      ref={imageFileRef}
                      className="visually-hidden"
                      type="file"
                      accept="image/*"
                      onChange={(e) => { loadImage(e.target.files?.[0]); e.target.value = ''; }}
                    />
                    <button
                      className={`upload-card ${selected.imageData ? 'has-image' : ''}`}
                      onClick={() => imageFileRef.current?.click()}
                    >
                      <span className="upload-icon"><ImagePlus size={17} /></span>
                      <span className="upload-copy">
                        <b>{selected.imageData ? 'استبدال صورتك' : 'إدراج صورة من جهازك'}</b>
                        <small>{selected.imageName || 'البرواز فارغ حالياً — اختر JPG أو PNG'}</small>
                      </span>
                      {selected.imageData ? <Check size={15} className="upload-check" /> : <Upload size={15} className="upload-arrow" />}
                    </button>

                    {selected.imageData && (
                      <div className="photo-tools">
                        <span className="field-label">ضبط صورتك</span>
                        <div className="photo-tool-buttons">
                          <button
                            onClick={() => updateFrame(selected.id, { imageRotation: (selected.imageRotation + 270) % 360 })}
                            title="تدوير لليسار"
                          >
                            <RotateCcw size={14} />
                          </button>
                          <button
                            onClick={() => updateFrame(selected.id, { imageRotation: (selected.imageRotation + 90) % 360 })}
                            title="تدوير لليمين"
                          >
                            <RotateCcw size={14} className="rotate-right" />
                          </button>
                          <button
                            className={selected.imageFlip ? 'active' : ''}
                            onClick={() => updateFrame(selected.id, { imageFlip: !selected.imageFlip })}
                            title="قلب أفقي"
                          >
                            <AlignHorizontalSpaceAround size={14} />
                          </button>
                          <button
                            onClick={() => {
                              updateFrame(selected.id, { imageData: '', imageName: '', imageRotation: 0, imageFlip: false });
                              setToast('تم تفريغ البرواز وأصبح فارغاً تماماً');
                            }}
                            title="إزالة الصورة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="glass-card">
                      <div className="glass-card-heading">
                        <span className="glass-glyph"><i /></span>
                        <span><b>واجهة زجاجية مصقولة</b><small>انعكاسات واقعية وشفافية كريستالية</small></span>
                        <span className="glass-tag">GLASS</span>
                      </div>
                      <ColorControl
                        label="لون انعكاس الزجاج"
                        value={selected.glassTint}
                        onChange={(color) => updateFrame(selected.id, { glassTint: color })}
                      />
                      <div className="range-line">
                        <span>قوة الانعكاس واللمعان</span>
                        <b>{selected.glassStrength}%</b>
                      </div>
                      <input
                        className="accent-range"
                        type="range"
                        min="5"
                        max="34"
                        value={selected.glassStrength}
                        onChange={(e) => updateFrame(selected.id, { glassStrength: Number(e.target.value) })}
                      />
                    </div>
                  </Section>

                  {/* Backdrop Color */}
                  <Section icon={Palette} title="لون جدار المعرض" note="تغيير لون الحائط خلف التكوين">
                    <ColorControl label="لون الجدار" value={background} onChange={setBackground} />
                    <div className="wall-swatches">
                      {WALL_SWATCHES.map((color) => (
                        <button
                          key={color}
                          className={background.toLowerCase() === color.toLowerCase() ? 'active' : ''}
                          style={{ background: color }}
                          onClick={() => setBackground(color)}
                          title={color}
                        />
                      ))}
                      <label className="palette-more" title="لون جدار مخصص">
                        <Plus size={12} />
                        <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} />
                      </label>
                    </div>
                  </Section>

                  <div className="delete-row">
                    <button onClick={duplicateFrame}><Copy size={14} />نسخ هذا البرواز</button>
                    <button className="delete-button" onClick={() => removeFrame(selected.id)}><Trash2 size={14} />حذف البرواز</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <FabricationPanel
              selected={selected}
              explode={explode}
              setExplode={setExplode}
              explodeMode={explodeMode}
              setExplodeMode={setExplodeMode}
              isolatePart={isolatePart}
              setIsolatePart={setIsolatePart}
              updateFrame={updateFrame}
              onExport={exportCutList}
              onOpenCinematic={() => setShowCinematic(true)}
            />
          )}
        </aside>
      </div>

      {/* Footer / Status Bar with Credits (Item 8) */}
      <footer className="status-bar">
        <div className="status-brand">
          <span className="status-mark" />BRWAAZ <span className="status-sep">·</span> استوديو تصميم البراويز 3D
        </div>

        {/* REQUIRED CREDITS (Requirement 8) */}
        <div className="credits-badge">
          <span className="credits-label">By:</span>
          <span className="credits-name">karem osama</span>
          <span className="credits-sep">&</span>
          <span className="credits-name">zyad elenany</span>
        </div>

        <div className="status-center">
          <span className="online-pulse" />محرك العرض جاهز <i /> WebGL 3D
        </div>
        <div className="status-right">
          <span>حفظ تلقائي فوري</span>
          <span className="status-version">v2.0 BRWAAZ</span>
        </div>
      </footer>

      {/* Cinematic 3D Video Player Fullscreen Modal */}
      {showCinematic && selected && (
        <CinematicPlayer frame={selected} onClose={() => setShowCinematic(false)} />
      )}

      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}

/* Fabrication & Masterful Designer Disassembly Panel (Requirement 5) */
function FabricationPanel({
  selected,
  explode,
  setExplode,
  explodeMode,
  setExplodeMode,
  isolatePart,
  setIsolatePart,
  updateFrame,
  onExport,
  onOpenCinematic,
}) {
  if (!selected) return null;

  const faceW = Math.max((selected.outerW - selected.innerW) / 2, 0);
  const faceH = Math.max((selected.outerH - selected.innerH) / 2, 0);
  const matW = Math.min(selected.matW, selected.innerW);
  const matH = Math.min(selected.matH, selected.innerH);
  const matBorder = selected.matEnabled && selected.showMat !== false ? selected.matBorder : 0;
  const photoW = selected.matEnabled && selected.showMat !== false ? Math.max(matW - 2 * matBorder, 0) : selected.innerW;
  const photoH = selected.matEnabled && selected.showMat !== false ? Math.max(matH - 2 * matBorder, 0) : selected.innerH;

  // Dynamic parts list based on designer toggles
  const parts = [
    ...(selected.showWood !== false ? [
      { name: 'عارضتان أفقيتان خشب', detail: `${selected.outerW} سم · وجه ${faceH.toFixed(1)} سم`, count: '02', icon: 'A' },
      { name: 'قائمان رأسيان خشب', detail: `${selected.outerH} سم · وجه ${faceW.toFixed(1)} سم`, count: '02', icon: 'B' },
    ] : []),
    ...(selected.showBackboard !== false ? [
      { name: 'لوح ظهر MDF مقوى', detail: `${(selected.outerW - 0.8).toFixed(1)} × ${(selected.outerH - 0.8).toFixed(1)} سم`, count: '01', icon: 'C' },
    ] : []),
    ...(selected.showGlass !== false ? [
      { name: 'لوح زجاج واجهة مصقول', detail: `${selected.innerW} × ${selected.innerH} سم · 3 مم`, count: '01', icon: 'D' },
    ] : []),
    ...(selected.matEnabled && selected.showMat !== false ? [
      { name: 'باسبارتو مشطوف داخلي', detail: `فتحة ${photoW.toFixed(1)} × ${photoH.toFixed(1)} سم`, count: '01', icon: 'E' },
    ] : []),
    ...(selected.showArtwork !== false ? [
      { name: 'العمل الفني / الصورة', detail: `${photoW.toFixed(1)} × ${photoH.toFixed(1)} سم`, count: '01', icon: 'P' },
    ] : []),
    ...(selected.showSplines !== false ? [
      { name: 'ألسنة تقوية مِيتَر 45°', detail: 'وصلات زوايا خشبية صلبة', count: '04', icon: 'F' },
    ] : []),
    ...(selected.showHardware !== false ? [
      { name: 'حلقات تعليق نحاسية + مسامير', detail: 'معدن مقوى للتثبيت الجداري', count: '02', icon: 'G' },
      { name: 'مصدات حماية مطاطية', detail: 'لضبط موازنة وتفريغ الهواء', count: '04', icon: 'H' },
    ] : []),
    ...(selected.showCornerBrackets ? [
      { name: 'زوايا نحاسية زخرفية', detail: 'حلية تقوية للواجهة الأمامية', count: '04', icon: 'J' },
    ] : []),
    ...(selected.showDustSeal ? [
      { name: 'شريط حماية الظهر كرافت', detail: 'عازل رطوبة وغبار عالي الجودة', count: '01', icon: 'K' },
    ] : []),
  ];

  return (
    <div className="property-scroll fabrication-scroll">
      <div className="fabrication-intro">
        <span className="fabrication-emblem"><Scissors size={20} /></span>
        <span>
          <b>أدوات المصمم للتفكيك والتركيب</b>
          <small>تحكّم كامل في إزالة وإضافة مكونات البرواز هندسياً</small>
        </span>
      </div>

      {/* Explode Control Card */}
      <div className="explode-card">
        <div className="explode-card-top">
          <span><Layers size={15} />مسافة التفكيك 3D</span>
          <b>{Math.round(explode * 100)}%</b>
        </div>
        <input
          className="accent-range explode-range"
          type="range"
          min="0"
          max="100"
          value={Math.round(explode * 100)}
          onChange={(e) => setExplode(Number(e.target.value) / 100)}
        />
        <div className="range-captions">
          <span>مجمّع بالكامل</span>
          <span>تفكيك شامل</span>
        </div>

        <div className="explode-quick-actions">
          <button className="explode-quick-btn" onClick={() => setExplode(0)}>
            تجميع (0%)
          </button>
          <button className="explode-quick-btn" onClick={() => setExplode(0.5)}>
            نصف تفكيك (50%)
          </button>
          <button className="explode-quick-btn" onClick={() => setExplode(1)}>
            تفكيك كامل (100%)
          </button>
        </div>

        <div className="explode-mode-toggle">
          <button
            className={`explode-mode-btn ${explodeMode === 'radial' ? 'active' : ''}`}
            onClick={() => setExplodeMode('radial')}
          >
            تباعد شعاعي 3D
          </button>
          <button
            className={`explode-mode-btn ${explodeMode === 'axial' ? 'active' : ''}`}
            onClick={() => setExplodeMode('axial')}
          >
            تباعد طولي محوري
          </button>
        </div>

        <button
          className="cutlist-button"
          style={{ marginTop: '12px' }}
          onClick={onOpenCinematic}
        >
          <Film size={15} />
          <span>تشغيل فيديو العرض السينمائي 3D</span>
        </button>
      </div>

      {/* Designer Component Management Tools (Requirement 5) */}
      <div className="designer-tools-box">
        <div className="designer-tools-title">
          <span>أدوات المصمم: إزالة وإضافة المكونات</span>
          <small>انقر لتعديل بنية البرواز</small>
        </div>

        <div className="component-toggle-list">
          {/* Glass */}
          <div className="component-toggle-item">
            <span>لوح الزجاج المصقول</span>
            <button
              className={`component-btn ${selected.showGlass !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showGlass: selected.showGlass === false })}
            >
              {selected.showGlass !== false ? 'موجود (مركّب)' : 'محذوف (بدون زجاج)'}
            </button>
          </div>

          {/* Mat Board */}
          <div className="component-toggle-item">
            <span>إطار الباسبارتو المشطوف</span>
            <button
              className={`component-btn ${selected.matEnabled && selected.showMat !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, {
                matEnabled: !(selected.matEnabled && selected.showMat !== false),
                showMat: !(selected.matEnabled && selected.showMat !== false),
              })}
            >
              {selected.matEnabled && selected.showMat !== false ? 'موجود' : 'محذوف'}
            </button>
          </div>

          {/* Artwork Print */}
          <div className="component-toggle-item">
            <span>لوحة الطباعة / الصورة</span>
            <button
              className={`component-btn ${selected.showArtwork !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showArtwork: selected.showArtwork === false })}
            >
              {selected.showArtwork !== false ? 'موجودة' : 'محذوفة'}
            </button>
          </div>

          {/* MDF Backboard */}
          <div className="component-toggle-item">
            <span>لوح ظهر MDF</span>
            <button
              className={`component-btn ${selected.showBackboard !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showBackboard: selected.showBackboard === false })}
            >
              {selected.showBackboard !== false ? 'موجود' : 'محذوف'}
            </button>
          </div>

          {/* Hardware */}
          <div className="component-toggle-item">
            <span>حلقات التعليق والمسامير</span>
            <button
              className={`component-btn ${selected.showHardware !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showHardware: selected.showHardware === false })}
            >
              {selected.showHardware !== false ? 'موجودة' : 'محذوفة'}
            </button>
          </div>

          {/* Corner Splines */}
          <div className="component-toggle-item">
            <span>ألسنة تقوية المِيتَر الخشبية</span>
            <button
              className={`component-btn ${selected.showSplines !== false ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showSplines: selected.showSplines === false })}
            >
              {selected.showSplines !== false ? 'موجودة' : 'محذوفة'}
            </button>
          </div>

          {/* Corner Brackets */}
          <div className="component-toggle-item">
            <span>زوايا نحاسية زخرفية للواجهة</span>
            <button
              className={`component-btn ${selected.showCornerBrackets ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showCornerBrackets: !selected.showCornerBrackets })}
            >
              {selected.showCornerBrackets ? 'مُضافة ✓' : '+ إضافة زوايا'}
            </button>
          </div>

          {/* Dust Seal */}
          <div className="component-toggle-item">
            <span>شريط حماية الظهر كرافت</span>
            <button
              className={`component-btn ${selected.showDustSeal ? 'active' : 'inactive'}`}
              onClick={() => updateFrame(selected.id, { showDustSeal: !selected.showDustSeal })}
            >
              {selected.showDustSeal ? 'مُضاف ✓' : '+ إضافة شريط'}
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="fabrication-metrics">
        <div>
          <span>طول × عرض البرواز</span>
          <b dir="ltr">{selected.outerW} × {selected.outerH}</b>
          <small>سم</small>
        </div>
        <div>
          <span>فتحة العمل الداخلي</span>
          <b dir="ltr">{photoW.toFixed(1)} × {photoH.toFixed(1)}</b>
          <small>سم</small>
        </div>
        <div>
          <span>سُمك الخشب</span>
          <b dir="ltr">{selected.thickness}</b>
          <small>سم</small>
        </div>
      </div>

      {/* Dynamic Parts List */}
      <div className="parts-list-heading">
        <b>قائمة قطع التصنيع المعتمدة</b>
        <span>{parts.length} مكونات معتمدة</span>
      </div>
      <div className="parts-list">
        {parts.map((part) => (
          <div className="part-row" key={part.icon + part.name}>
            <span className="part-code">{part.icon}</span>
            <span className="part-copy">
              <b>{part.name}</b>
              <small>{part.detail}</small>
            </span>
            <span className="part-count">×{part.count}</span>
          </div>
        ))}
      </div>

      <div className="carpenter-note">
        <span><Sparkles size={14} /></span>
        <p>
          <b>إرشادات التصنيع والتجميع</b><br />
          قص زوايا المِيتَر 45° بدقة مع حفر مجاري ألسنة التقوية. يتم تركيب الزجاج والطباعة والباسبارتو من الداخل، ثم تثبيت لوح الظهر MDF بحلقات التعليق المتوازنة.
        </p>
      </div>

      <button className="cutlist-button" onClick={onExport}>
        <ArrowDownToLine size={16} />تصدير جدول القص والمواد للورشة <span>.CSV</span>
      </button>
      <div className="cutlist-note"><FileImage size={13} />ملف متوافق مع Excel وجداول البيانات</div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
