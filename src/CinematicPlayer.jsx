import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Camera,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { createFrameModel } from './frame-model.js';

export default function CinematicPlayer({ frame, onClose }) {
  const containerRef = useRef(null);
  const canvasHostRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [speed, setSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState('cinematic'); // 'cinematic' | 'front' | 'iso'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentStageText, setCurrentStageText] = useState('استعراض البرواز المجمّع');

  const animStateRef = useRef({
    time: 0,
    duration: 16, // 16 seconds full cycle
    playing: true,
    speed: 1,
    cameraMode: 'cinematic',
    userInteracting: false,
    interactTimeout: null,
    controls: null,
    camera: null,
    scene: null,
  });

  animStateRef.current.playing = isPlaying;
  animStateRef.current.speed = speed;
  animStateRef.current.cameraMode = cameraMode;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard shortcut (Escape to close, Space to toggle play)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return undefined;

    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#120408');

    // Studio wall backdrop
    const groundGeo = new THREE.PlaneGeometry(32, 24);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#1a070f',
      roughness: 0.92,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.z = -0.38;
    ground.receiveShadow = true;
    scene.add(ground);

    const targetDist = Math.max(Number(frame.outerW || 80), Number(frame.outerH || 60)) / 44 + 0.7;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 50);
    camera.position.set(targetDist * 0.45, targetDist * 0.28, targetDist * 0.88);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'cinematic-canvas';
    host.appendChild(renderer.domElement);

    // Dramatic Studio Lighting
    const hemiLight = new THREE.HemisphereLight('#fff5f8', '#2b0914', 1.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fffaf4', 3.4);
    keyLight.position.set(-2.8, 3.4, 3.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0003;
    scene.add(keyLight);

    const rubyRim = new THREE.DirectionalLight('#ff2a55', 2.8);
    rubyRim.position.set(3.4, -1.8, 2.6);
    scene.add(rubyRim);

    const backFill = new THREE.DirectionalLight('#fff6ee', 1.3);
    backFill.position.set(0, -3, 3);
    scene.add(backFill);

    // Standard OrbitControls: 100% natural, standard un-inverted 3D tumble & zoom!
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 12;
    controls.target.set(0, 0, 0);

    // Track user mouse interaction so manual orbit does not fight automatic camera
    controls.addEventListener('start', () => {
      animStateRef.current.userInteracting = true;
      if (animStateRef.current.interactTimeout) {
        clearTimeout(animStateRef.current.interactTimeout);
      }
    });

    controls.addEventListener('end', () => {
      if (animStateRef.current.interactTimeout) {
        clearTimeout(animStateRef.current.interactTimeout);
      }
      animStateRef.current.interactTimeout = setTimeout(() => {
        animStateRef.current.userInteracting = false;
      }, 3500);
    });

    animStateRef.current.controls = controls;
    animStateRef.current.camera = camera;
    animStateRef.current.scene = scene;

    let currentFrameGroup = null;
    let lastExplodeVal = -1;

    const updateModelExplode = (expVal) => {
      if (Math.abs(expVal - lastExplodeVal) < 0.003 && currentFrameGroup) return;
      lastExplodeVal = expVal;
      if (currentFrameGroup) {
        scene.remove(currentFrameGroup);
        currentFrameGroup.traverse((n) => {
          if (n.geometry) n.geometry.dispose();
          if (n.material) {
            if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
            else n.material.dispose();
          }
        });
      }
      currentFrameGroup = createFrameModel(frame, {
        explode: expVal,
        explodeMode: 'radial',
        selected: false,
      });
      currentFrameGroup.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
        }
      });
      scene.add(currentFrameGroup);
    };

    // Initial build
    updateModelExplode(0);

    const onResize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(host);

    let lastTimestamp = performance.now();
    let animId = 0;

    const animate = (now) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
      lastTimestamp = now;

      const state = animStateRef.current;
      if (state.playing) {
        state.time += dt * state.speed;
        if (state.time > state.duration) {
          state.time = 0; // Seamless loop
        }
        setProgress(state.time / state.duration);
      }

      const tNorm = state.time / state.duration; // 0 to 1

      // 5 Distinct, physically accurate timeline phases:
      // Phase 1 (0 to 0.16): Assembled inspection
      // Phase 2 (0.16 to 0.45): Smooth explosion (glass floats forward, wood rails expand at 45°, backboard recedes)
      // Phase 3 (0.45 to 0.65): Full exploded inspection 3D orbit
      // Phase 4 (0.65 to 0.88): Precision reverse assembly
      // Phase 5 (0.88 to 1.0): Finished frame beauty shot
      let currentExplode = 0;
      let stageText = '';

      if (tNorm < 0.16) {
        currentExplode = 0;
        stageText = '✨ استعراض البرواز المجمّع وخامات التصنيع';
      } else if (tNorm < 0.45) {
        const p = (tNorm - 0.16) / (0.45 - 0.16);
        currentExplode = 0.5 - 0.5 * Math.cos(p * Math.PI); // Smooth ease in-out
        stageText = '💥 تفكيك هندسي متقن: الزجاج، الباسبارتو، الخشب، لوح الظهر';
      } else if (tNorm < 0.65) {
        currentExplode = 1.0;
        stageText = '🔬 فحص الأجزاء المفككة في الفضاء 3D وهندسة المِيتَر 45°';
      } else if (tNorm < 0.88) {
        const p = (tNorm - 0.65) / (0.88 - 0.65);
        currentExplode = 0.5 + 0.5 * Math.cos(p * Math.PI); // Smooth reverse ease
        stageText = '⚡ إعادة تركيب وتجميع القطع وانطباقها بدقة';
      } else {
        currentExplode = 0;
        stageText = '🎯 البرواز مكتمل وجاهز للمعاينة والعرض النهائي';
      }

      setCurrentStageText(stageText);
      updateModelExplode(currentExplode);

      // Automated Cinematic Camera Motion (only when user is not manually rotating)
      if (!state.userInteracting) {
        const rad = targetDist + currentExplode * 0.35;

        if (state.cameraMode === 'cinematic') {
          // Smooth sweeping arc in front of the frame showing 3D depth
          // Azimuth angle sweeps smoothly
          let azimuth = 0;
          if (tNorm < 0.45) {
            azimuth = -0.35 + (tNorm / 0.45) * 0.7; // -0.35 to +0.35 rad
          } else if (tNorm < 0.65) {
            const p = (tNorm - 0.45) / 0.2;
            azimuth = 0.35 + p * Math.PI * 0.9; // Dynamic rotation around exploded parts
          } else {
            const p = (tNorm - 0.65) / 0.35;
            azimuth = 0.35 * (1 - p); // Return smoothly to front-angle
          }

          const elevation = 0.22 + Math.sin(tNorm * Math.PI) * 0.12;
          const targetCamX = rad * Math.sin(azimuth) * Math.cos(elevation);
          const targetCamY = rad * Math.sin(elevation);
          const targetCamZ = rad * Math.cos(azimuth) * Math.cos(elevation);

          camera.position.x += (targetCamX - camera.position.x) * 0.06;
          camera.position.y += (targetCamY - camera.position.y) * 0.06;
          camera.position.z += (targetCamZ - camera.position.z) * 0.06;
          controls.target.set(0, 0, 0);
        } else if (state.cameraMode === 'front') {
          const targetCamZ = rad + 0.2;
          camera.position.x += (0 - camera.position.x) * 0.08;
          camera.position.y += (0 - camera.position.y) * 0.08;
          camera.position.z += (targetCamZ - camera.position.z) * 0.08;
          controls.target.set(0, 0, 0);
        } else if (state.cameraMode === 'iso') {
          const targetCamX = rad * 0.52;
          const targetCamY = rad * 0.36;
          const targetCamZ = rad * 0.78;
          camera.position.x += (targetCamX - camera.position.x) * 0.08;
          camera.position.y += (targetCamY - camera.position.y) * 0.08;
          camera.position.z += (targetCamZ - camera.position.z) * 0.08;
          controls.target.set(0, 0, 0);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      controls.dispose();
      if (currentFrameGroup) scene.remove(currentFrameGroup);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [frame]);

  const handleScrubberChange = (e) => {
    const nextProg = Number(e.target.value);
    setProgress(nextProg);
    animStateRef.current.time = nextProg * animStateRef.current.duration;
  };

  const handleRestart = () => {
    setProgress(0);
    animStateRef.current.time = 0;
    setIsPlaying(true);
  };

  const currentSeconds = Math.floor(progress * 16);
  const formattedTime = `00:${String(currentSeconds).padStart(2, '0')}`;

  return (
    <div className="cinematic-player-overlay" ref={containerRef} dir="rtl">
      {/* 3D Scene Viewport */}
      <div className="cinematic-canvas-host" ref={canvasHostRef} />

      {/* Floating Header */}
      <header className="cinematic-header">
        <div className="cinematic-title-box">
          <span className="cinematic-badge">
            <Sparkles size={13} /> مشغل 3D سينمائي
          </span>
          <div className="cinematic-title-text">
            <strong>{frame.name}</strong>
            <span dir="ltr">{frame.outerW} × {frame.outerH} cm</span>
          </div>
        </div>

        <div className="cinematic-stage-indicator">
          <span className="cinematic-pulse-dot" />
          <span>{currentStageText}</span>
        </div>

        <div className="cinematic-header-actions">
          <button
            className="cinematic-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة كاملة'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button className="cinematic-btn close-btn" onClick={onClose} title="إغلاق المشغل (Esc)">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Helper hint */}
      <div className="cinematic-hint">
        <span>💡 يمكنك سحب الماوس في أي لحظة للتدوير 360° واستعراض البرواز والتقريب بعجلة الفأرة</span>
      </div>

      {/* Bottom Video Controls Bar: strictly dir="ltr" so progress runs correctly left-to-right */}
      <div className="cinematic-control-bar" dir="ltr">
        {/* Timeline Scrubber */}
        <div className="cinematic-scrubber-wrap">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleScrubberChange}
            className="cinematic-scrubber"
            aria-label="شريط تقدم الفيديو ثلاثي الأبعاد"
          />
          <div
            className="cinematic-scrubber-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="cinematic-controls-row">
          {/* Play / Pause & Restart */}
          <div className="cinematic-playback-btns">
            <button
              className="cinematic-play-btn"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'إيقاف مؤقت (مسافة)' : 'تشغيل (مسافة)'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
            </button>
            <button className="cinematic-btn" onClick={handleRestart} title="إعادة تشغيل من البداية">
              <RotateCcw size={15} />
            </button>
            <span className="cinematic-timecode">
              {formattedTime} / 00:16
            </span>
          </div>

          {/* Camera Angles */}
          <div className="cinematic-camera-selector" dir="rtl">
            <span className="selector-label">الكاميرا:</span>
            <button
              className={`cinematic-chip ${cameraMode === 'cinematic' ? 'active' : ''}`}
              onClick={() => {
                setCameraMode('cinematic');
                animStateRef.current.userInteracting = false;
              }}
            >
              مداري سينمائي
            </button>
            <button
              className={`cinematic-chip ${cameraMode === 'iso' ? 'active' : ''}`}
              onClick={() => {
                setCameraMode('iso');
                animStateRef.current.userInteracting = false;
              }}
            >
              منظور 3D مائل
            </button>
            <button
              className={`cinematic-chip ${cameraMode === 'front' ? 'active' : ''}`}
              onClick={() => {
                setCameraMode('front');
                animStateRef.current.userInteracting = false;
              }}
            >
              واجهة كاملة
            </button>
          </div>

          {/* Speed selector */}
          <div className="cinematic-speed-selector">
            <span className="selector-label">السرعة:</span>
            {[0.5, 1, 1.5, 2].map((s) => (
              <button
                key={s}
                className={`cinematic-speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
