import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createFrameModel } from './frame-model.js';

function disposeTree(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (!node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material.map) material.map.dispose();
      material.dispose();
    }
  });
}

function frameIdFromObject(object) {
  let node = object;
  while (node) {
    if (node.userData?.frameId) return node.userData.frameId;
    node = node.parent;
  }
  return null;
}

export default function ThreeViewport({
  frames,
  selectedId,
  onSelect,
  onMoveFrame,
  arrangeMode,
  explode,
  explodeMode = 'radial',
  isolatePart = 'all',
  background,
  autoRotate,
  apiRef,
}) {
  const hostRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const frameRootsRef = useRef([]);
  const propsRef = useRef({});
  const fitRef = useRef(() => {});

  propsRef.current = {
    frames,
    selectedId,
    onSelect,
    onMoveFrame,
    arrangeMode,
    explode,
    explodeMode,
    isolatePart,
    background,
    autoRotate,
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(propsRef.current.background || '#f3eee7');

    const camera = new THREE.PerspectiveCamera(36, host.clientWidth / Math.max(host.clientHeight, 1), 0.01, 100);
    // Initial dynamic 3D angle so depth and wood bevels are instantly visible
    camera.position.set(0.38, 0.24, 2.1);
    cameraRef.current = camera;
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'three-canvas';
    renderer.domElement.setAttribute('aria-label', 'معاينة تفاعلية ثلاثية الأبعاد للبراويز');
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: propsRef.current.background || '#f3eee7',
      roughness: 0.95,
      metalness: 0,
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), wallMaterial);
    wall.position.z = -0.13;
    wall.receiveShadow = true;
    wall.name = 'خلفية حائط المعرض';
    scene.add(wall);

    const hemi = new THREE.HemisphereLight('#ffffff', '#8a2035', 1.6);
    hemi.position.set(0, 2, 2);
    scene.add(hemi);

    const key = new THREE.DirectionalLight('#fff5eb', 3.2);
    key.position.set(-2.8, 3.8, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 5;
    scene.add(key);
    scene.add(key.target);

    const fill = new THREE.DirectionalLight('#ffe8ed', 0.9);
    fill.position.set(3, 1.1, 2.5);
    scene.add(fill);

    const rim = new THREE.DirectionalLight('#ff2a55', 1.3);
    rim.position.set(-0.5, -2, 2.6);
    scene.add(rim);

    // OrbitControls for true, un-inverted, full 360° 3D inspection
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.minDistance = 0.55;
    controls.maxDistance = 16;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.88;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const dragOffset = new THREE.Vector3();
    const intersectPoint = new THREE.Vector3();

    const drag = {
      active: false,
      id: null,
      group: null,
      moved: false,
      pointerId: null,
    };

    let pointerDownPos = { x: 0, y: 0 };
    let hasMovedMouse = false;

    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const handleDown = (event) => {
      if (event.button !== 0) return; // Only left click
      pointerDownPos = { x: event.clientX, y: event.clientY };
      hasMovedMouse = false;

      updatePointer(event);
      const roots = frameRootsRef.current;
      const hit = raycaster.intersectObjects(roots, true).find((item) => frameIdFromObject(item.object));

      // Check whether this action is meant to MOVE the frame position:
      // Dragging moves the frame ONLY when in Arrange Mode OR when holding Shift / Alt key!
      const isArrangeMode = propsRef.current.arrangeMode || event.shiftKey || event.altKey;

      if (hit) {
        const id = frameIdFromObject(hit.object);
        const group = roots.find((item) => item.userData.frameId === id);
        if (!group) return;

        // Select the clicked frame
        propsRef.current.onSelect?.(id);

        if (isArrangeMode) {
          // Enter Move Frame Dragging
          dragPlane.set(new THREE.Vector3(0, 0, 1), -group.position.z);
          if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
            dragOffset.copy(intersectPoint).sub(group.position);
            drag.active = true;
            drag.id = id;
            drag.group = group;
            drag.moved = false;
            drag.pointerId = event.pointerId;

            controls.enabled = false;
            renderer.domElement.style.cursor = 'grabbing';
            try {
              renderer.domElement.setPointerCapture(event.pointerId);
            } catch {}
            event.stopPropagation();
          }
        } else {
          // 3D Viewing Mode: OrbitControls is active!
          // Left-click drag smoothly rotates the 3D scene around the model!
          controls.enabled = true;
          renderer.domElement.style.cursor = 'grab';
        }
      } else {
        // Click on background
        controls.enabled = !propsRef.current.arrangeMode;
      }
    };

    const handleMove = (event) => {
      const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      if (dist > 3) hasMovedMouse = true;

      updatePointer(event);

      // If active dragging a frame in Arrange Mode
      if (drag.active && drag.group) {
        if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
          const newX = intersectPoint.x - dragOffset.x;
          const newY = intersectPoint.y - dragOffset.y;
          drag.group.position.x = newX;
          drag.group.position.y = newY;
          drag.moved = true;
        }
        return;
      }

      // Hover cursor management
      if (propsRef.current.arrangeMode) {
        const roots = frameRootsRef.current;
        const hit = raycaster.intersectObjects(roots, true).find((item) => frameIdFromObject(item.object));
        renderer.domElement.style.cursor = hit ? 'move' : 'default';
      } else {
        renderer.domElement.style.cursor = 'default';
      }
    };

    const handleUp = (event) => {
      if (drag.active && drag.group) {
        const { id, group, moved } = drag;
        drag.active = false;
        drag.id = null;
        drag.group = null;

        controls.enabled = !propsRef.current.arrangeMode;
        renderer.domElement.style.cursor = propsRef.current.arrangeMode ? 'move' : 'default';

        if (drag.pointerId !== null) {
          try {
            renderer.domElement.releasePointerCapture(drag.pointerId);
          } catch {}
          drag.pointerId = null;
        }

        if (moved) {
          propsRef.current.onMoveFrame?.(id, group.position.x, group.position.y);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handleDown, true);
    renderer.domElement.addEventListener('pointermove', handleMove, true);
    renderer.domElement.addEventListener('pointerup', handleUp, true);
    renderer.domElement.addEventListener('pointercancel', handleUp, true);

    const fitToContent = (animate = true) => {
      const currentFrames = propsRef.current.frames || [];
      if (!currentFrames.length) return;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const frame of currentFrames) {
        const halfW = Number(frame.outerW) / 200;
        const halfH = Number(frame.outerH) / 200;
        minX = Math.min(minX, (frame.x || 0) - halfW);
        maxX = Math.max(maxX, (frame.x || 0) + halfW);
        minY = Math.min(minY, (frame.y || 0) - halfH);
        maxY = Math.max(maxY, (frame.y || 0) + halfH);
      }
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = Math.max(maxX - minX, 0.5);
      const height = Math.max(maxY - minY, 0.6);
      const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), 0.75);
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const distance = (Math.max(height, width / aspect) / (2 * tan)) * 1.25;
      const goal = new THREE.Vector3(centerX + 0.3, centerY + 0.2, Math.max(distance, 1.15));
      controls.target.set(centerX, centerY, 0);
      if (animate) camera.position.lerp(goal, 0.85);
      else camera.position.copy(goal);
      camera.lookAt(controls.target);
      controls.update();
    };
    fitRef.current = fitToContent;

    let lastCount = -1;
    const rebuildModels = () => {
      for (const root of frameRootsRef.current) {
        scene.remove(root);
        disposeTree(root);
      }
      const current = propsRef.current;
      frameRootsRef.current = (current.frames || []).map((frame) => {
        const root = createFrameModel(frame, {
          selected: frame.id === current.selectedId,
          explode: current.explode,
          explodeMode: current.explodeMode || 'radial',
          isolatePart: current.isolatePart || 'all',
        });
        root.position.set(frame.x || 0, frame.y || 0, 0);
        root.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        scene.add(root);
        return root;
      });
      wallMaterial.color.set(current.background || '#f3eee7');
      scene.background = new THREE.Color(current.background || '#f3eee7');
      if (current.frames.length !== lastCount) {
        lastCount = current.frames.length;
        fitToContent(false);
      }
    };
    const initialBuild = setTimeout(rebuildModels, 0);

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let animationId = 0;
    const render = () => {
      animationId = requestAnimationFrame(render);
      controls.enabled = !propsRef.current.arrangeMode && !drag.active;
      controls.autoRotate = !!propsRef.current.autoRotate;
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    if (apiRef) {
      apiRef.current = {
        fit: () => fitRef.current(false),
        view: (viewName) => {
          const center = controls.target.clone();
          const distance = Math.max(camera.position.distanceTo(center), 1.15);
          const destinations = {
            iso: new THREE.Vector3(center.x + distance * 0.48, center.y + distance * 0.32, center.z + distance * 0.82),
            front: new THREE.Vector3(center.x, center.y, center.z + distance),
            back: new THREE.Vector3(center.x, center.y, center.z - distance),
            right: new THREE.Vector3(center.x + distance, center.y, center.z),
            left: new THREE.Vector3(center.x - distance, center.y, center.z),
            top: new THREE.Vector3(center.x, center.y + distance, center.z + 0.001),
          };
          camera.position.copy(destinations[viewName] || destinations.iso);
          camera.up.set(0, 1, 0);
          camera.lookAt(center);
          controls.update();
        },
        savePng: (filename = 'BRWAAZ-preview.png') => {
          renderer.render(scene, camera);
          const link = document.createElement('a');
          link.download = filename;
          link.href = renderer.domElement.toDataURL('image/png');
          link.click();
        },
      };
    }

    return () => {
      clearTimeout(initialBuild);
      cancelAnimationFrame(animationId);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handleDown, true);
      renderer.domElement.removeEventListener('pointermove', handleMove, true);
      renderer.domElement.removeEventListener('pointerup', handleUp, true);
      renderer.domElement.removeEventListener('pointercancel', handleUp, true);
      controls.dispose();
      for (const root of frameRootsRef.current) disposeTree(root);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      if (apiRef) apiRef.current = {};
    };
  }, [apiRef]);

  // Re-build 3D models when frames or designer toggles change
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return undefined;

    for (const root of frameRootsRef.current) {
      scene.remove(root);
      disposeTree(root);
    }
    frameRootsRef.current = frames.map((frame) => {
      const root = createFrameModel(frame, {
        selected: frame.id === selectedId,
        explode,
        explodeMode,
        isolatePart,
      });
      root.position.set(frame.x || 0, frame.y || 0, 0);
      root.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(root);
      return root;
    });
    const wall = scene.getObjectByName('خلفية حائط المعرض');
    if (wall) wall.material.color.set(background || '#f3eee7');
    scene.background = new THREE.Color(background || '#f3eee7');

    const countRef = renderer.domElement.dataset.frameCount;
    if (countRef !== String(frames.length)) {
      renderer.domElement.dataset.frameCount = String(frames.length);
      fitRef.current(false);
    }
    return undefined;
  }, [frames, selectedId, explode, explodeMode, isolatePart, background]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.autoRotate = !!autoRotate;
    controls.enabled = !arrangeMode;
  }, [autoRotate, arrangeMode]);

  return <div className="three-viewport" ref={hostRef} />;
}
