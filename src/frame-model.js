import * as THREE from 'three';

const cm = (value) => Number(value || 0) / 100;

function shapeFrom(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

function addRail(parent, points, depth, material, name, separation = 0, radial = [0, 0]) {
  const geometry = new THREE.ExtrudeGeometry(shapeFrom(points), {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.0011, depth * 0.045),
    bevelSize: 0.0011,
    bevelSegments: 2,
    curveSegments: 1,
    steps: 1,
  });
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  group.name = name;
  group.userData.partName = name;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -depth / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.position.set(radial[0] * separation, radial[1] * separation, separation * 0.3);
  parent.add(group);
  return group;
}

function cropPhoto(ctx, image, targetWidth, targetHeight, rotation, flip) {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const angle = ((rotation % 360) * Math.PI) / 180;
  const sideways = Math.abs(rotation % 180) === 90;
  const imageWidth = sideways ? image.naturalHeight : image.naturalWidth;
  const imageHeight = sideways ? image.naturalWidth : image.naturalHeight;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function createArtwork(frame, photoWidth, photoHeight) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.max(1, Math.round((1200 * photoHeight) / Math.max(photoWidth, 0.01)));
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Clean empty museum art backing - strictly NO example person or landscape silhouettes
  const drawCleanBlankPaper = () => {
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(210, 200, 190, 0.35)';
    ctx.lineWidth = Math.max(2, Math.round(w * 0.004));
    ctx.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
  };

  if (!frame.imageData) {
    drawCleanBlankPaper();
    return canvas;
  }

  const image = new Image();
  image.src = frame.imageData;
  if (!image.complete || !image.naturalWidth) {
    drawCleanBlankPaper();
    image._kadrCanvas = canvas;
    image.onload = () => {
      if (!image._kadrCanvas) return;
      cropPhoto(
        image._kadrCanvas.getContext('2d'),
        image,
        photoWidth,
        photoHeight,
        frame.imageRotation || 0,
        !!frame.imageFlip,
      );
      image._kadrCanvas.dispatchEvent(new Event('kadr-image-ready'));
    };
    return canvas;
  }
  cropPhoto(ctx, image, photoWidth, photoHeight, frame.imageRotation || 0, !!frame.imageFlip);
  return canvas;
}

function addPinstripes(parent, outerW, outerH, innerW, innerH, color, z) {
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const paths = [
    [
      [-outerW / 2 + 0.006, -outerH / 2 + 0.006],
      [outerW / 2 - 0.006, -outerH / 2 + 0.006],
      [outerW / 2 - 0.006, outerH / 2 - 0.006],
      [-outerW / 2 + 0.006, outerH / 2 - 0.006],
    ],
    [
      [-innerW / 2 - 0.006, -innerH / 2 - 0.006],
      [innerW / 2 + 0.006, -innerH / 2 - 0.006],
      [innerW / 2 + 0.006, innerH / 2 + 0.006],
      [-innerW / 2 - 0.006, innerH / 2 + 0.006],
    ],
  ];
  for (const path of paths) {
    const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(path.map(([x, y]) => new THREE.Vector3(x, y, z))), material);
    line.renderOrder = 6;
    parent.add(line);
  }
}

function addHardware(parent, width, height, depth, amount) {
  const z = -depth / 2 - 0.006 - amount * 0.08;
  const brass = new THREE.MeshStandardMaterial({ color: '#b9a577', metalness: 0.78, roughness: 0.25 });
  const steel = new THREE.MeshStandardMaterial({ color: '#6d7782', metalness: 0.72, roughness: 0.32 });
  const pairX = Math.min(width * 0.27, width / 2 - 0.045);
  const hangerY = height / 2 - 0.055;
  for (const side of [-1, 1]) {
    const x = side * pairX;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0022, 8, 20), brass);
    ring.position.set(x, hangerY, z);
    ring.name = 'حلقة تعليق معدنية';
    ring.castShadow = true;
    parent.add(ring);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.0018), steel);
    plate.position.set(x, hangerY - 0.016, z + 0.002);
    plate.name = 'قاعدة حلقة التعليق';
    parent.add(plate);
    for (const offset of [-0.007, 0.007]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0018, 12), brass);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x + offset, hangerY - 0.016, z + 0.0035 + amount * 0.015);
      screw.name = 'مسمار تعليق';
      parent.add(screw);
    }
  }
  const inset = Math.min(0.045, width / 8, height / 8);
  for (const [x, y, angle] of [
    [-width / 2 + inset, -height / 2 + inset, -Math.PI / 4],
    [width / 2 - inset, -height / 2 + inset, Math.PI / 4],
    [-width / 2 + inset, height / 2 - inset, Math.PI / 4],
    [width / 2 - inset, height / 2 - inset, -Math.PI / 4],
  ]) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.037, 0.005, 0.0016), brass);
    key.position.set(x, y, z - 0.001);
    key.rotation.z = angle;
    key.name = 'لسان تقوية زاوية';
    key.castShadow = true;
    parent.add(key);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.0018, 12), steel);
    head.rotation.x = Math.PI / 2;
    head.position.set(x + Math.cos(angle) * 0.009, y + Math.sin(angle) * 0.009, z);
    head.name = 'مسمار تثبيت زاوية';
    parent.add(head);
  }
  const bumper = new THREE.MeshStandardMaterial({ color: '#252b2f', roughness: 0.86 });
  for (const [x, y] of [
    [-width * 0.25, 0],
    [width * 0.25, 0],
    [0, -height * 0.35],
    [0, height * 0.32],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), bumper);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(x, y, z + 0.002);
    foot.name = 'مصدّ حماية خلفي';
    parent.add(foot);
  }
}

function addCornerBrackets(parent, outerW, outerH, frontZ, amount) {
  const brass = new THREE.MeshStandardMaterial({ color: '#c5a769', metalness: 0.82, roughness: 0.22 });
  const size = Math.min(0.045, outerW * 0.15, outerH * 0.15);
  const thickness = 0.002;
  const z = frontZ + 0.001 + amount * 0.04;
  const corners = [
    [-outerW / 2, outerH / 2, 0],
    [outerW / 2, outerH / 2, -Math.PI / 2],
    [outerW / 2, -outerH / 2, Math.PI],
    [-outerW / 2, -outerH / 2, Math.PI / 2],
  ];
  for (const [cx, cy, rot] of corners) {
    const group = new THREE.Group();
    group.position.set(cx, cy, z);
    group.rotation.z = rot;
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.28, thickness), brass);
    arm1.position.set(size / 2, -size * 0.14, 0);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.28, size, thickness), brass);
    arm2.position.set(size * 0.14, -size / 2, 0);
    group.add(arm1);
    group.add(arm2);
    group.name = 'زاوية معدنية زخرفية';
    parent.add(group);
  }
}

function addDustSeal(parent, outerW, outerH, z) {
  const kraftMat = new THREE.MeshStandardMaterial({ color: '#8d7152', roughness: 0.94 });
  const tapeWidth = 0.024;
  const topTape = new THREE.Mesh(new THREE.PlaneGeometry(outerW - 0.01, tapeWidth), kraftMat);
  topTape.position.set(0, outerH / 2 - tapeWidth / 2 - 0.005, z);
  parent.add(topTape);
  const bottomTape = new THREE.Mesh(new THREE.PlaneGeometry(outerW - 0.01, tapeWidth), kraftMat);
  bottomTape.position.set(0, -outerH / 2 + tapeWidth / 2 + 0.005, z);
  parent.add(bottomTape);
  const leftTape = new THREE.Mesh(new THREE.PlaneGeometry(tapeWidth, outerH - 0.01), kraftMat);
  leftTape.position.set(-outerW / 2 + tapeWidth / 2 + 0.005, 0, z);
  parent.add(leftTape);
  const rightTape = new THREE.Mesh(new THREE.PlaneGeometry(tapeWidth, outerH - 0.01), kraftMat);
  rightTape.position.set(outerW / 2 - tapeWidth / 2 - 0.005, 0, z);
  parent.add(rightTape);
}

function addGlassHighlights(parent, width, height, strength) {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: strength,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.19, height * 0.92), material);
  streak.position.set(-width * 0.3, height * 0.015, 0.001);
  streak.rotation.z = -0.33;
  streak.renderOrder = 8;
  parent.add(streak);
  const soft = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.06, height * 0.68),
    new THREE.MeshBasicMaterial({
      color: '#c9f0ff',
      transparent: true,
      opacity: strength * 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  soft.position.set(width * 0.31, -height * 0.04, 0.0012);
  soft.rotation.z = -0.33;
  soft.renderOrder = 9;
  parent.add(soft);
}

export function createFrameModel(
  frame,
  {
    selected = false,
    explode = 0,
    explodeMode = 'radial',
    isolatePart = 'all',
    showWood = frame.showWood !== false,
    showGlass = frame.showGlass !== false,
    showMat = frame.showMat !== false && frame.matEnabled !== false,
    showArtwork = frame.showArtwork !== false,
    showBackboard = frame.showBackboard !== false,
    showHardware = frame.showHardware !== false,
    showSplines = frame.showSplines !== false,
    showCornerBrackets = !!frame.showCornerBrackets,
    showDustSeal = !!frame.showDustSeal,
  } = {},
) {
  const root = new THREE.Group();
  root.userData.frameId = frame.id;
  root.name = frame.name;

  const outerW = cm(frame.outerW);
  const outerH = cm(frame.outerH);
  const innerW = Math.min(cm(frame.innerW), outerW - 0.01);
  const innerH = Math.min(cm(frame.innerH), outerH - 0.01);
  const depth = Math.max(cm(frame.thickness), 0.004);
  const matW = Math.min(cm(frame.matW), innerW);
  const matH = Math.min(cm(frame.matH), innerH);
  const matBorder = showMat ? Math.min(cm(frame.matBorder), (Math.min(matW, matH) - 0.02) / 2) : 0;
  const photoW = Math.max((showMat ? matW : innerW) - 2 * matBorder, 0.02);
  const photoH = Math.max((showMat ? matH : innerH) - 2 * matBorder, 0.02);
  const exp = Math.max(0, Math.min(Number(explode) || 0, 1));
  const frontZ = depth / 2;

  const isVisible = (partKey) => {
    if (isolatePart === 'all') return true;
    return isolatePart === partKey;
  };

  // 1. Wood frame outer rails
  if (showWood && isVisible('wood')) {
    const roughness = frame.finish === 'gloss' ? 0.2 : frame.finish === 'matte' ? 0.56 : 0.34;
    const wood = new THREE.MeshPhysicalMaterial({
      color: frame.woodColor || '#245f82',
      metalness: 0.03,
      roughness,
      clearcoat: frame.finish === 'gloss' ? 0.43 : 0.16,
      clearcoatRoughness: 0.28,
    });
    const outerX = outerW / 2;
    const outerY = outerH / 2;
    const innerX = innerW / 2;
    const innerY = innerH / 2;
    const railGap = (explodeMode === 'radial' ? 0.055 : 0.022) * exp;
    const railParts = [
      {
        name: 'العارضة العلوية — مِيتَر 45°',
        points: [
          [-outerX, outerY],
          [outerX, outerY],
          [innerX, innerY],
          [-innerX, innerY],
        ],
        radial: [0, 1],
      },
      {
        name: 'العارضة السفلية — مِيتَر 45°',
        points: [
          [-innerX, -innerY],
          [innerX, -innerY],
          [outerX, -outerY],
          [-outerX, -outerY],
        ],
        radial: [0, -1],
      },
      {
        name: 'القائم الأيسر — مِيتَر 45°',
        points: [
          [-outerX, outerY],
          [-innerX, innerY],
          [-innerX, -innerY],
          [-outerX, -outerY],
        ],
        radial: [-1, 0],
      },
      {
        name: 'القائم الأيمن — مِيتَر 45°',
        points: [
          [innerX, innerY],
          [outerX, outerY],
          [outerX, -outerY],
          [innerX, -innerY],
        ],
        radial: [1, 0],
      },
    ];
    railParts.forEach((rail) => addRail(root, rail.points, depth, wood, rail.name, railGap, rail.radial));
    if (frame.pinstripe) {
      addPinstripes(root, outerW, outerH, innerW, innerH, frame.pinstripeColor || '#eefaff', frontZ + 0.001);
    }
  }

  // 2. Decorative Corner Brackets (designer tool)
  if (showCornerBrackets && isVisible('wood')) {
    addCornerBrackets(root, outerW, outerH, frontZ, exp);
  }

  // 3. Mat board (باسبارتو)
  if (showMat && isVisible('mat')) {
    const material = new THREE.MeshStandardMaterial({
      color: frame.matColor || '#e8e0d2',
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const mx = matW / 2;
    const my = matH / 2;
    const aix = Math.max((matW - 2 * matBorder) / 2, 0.009);
    const aiy = Math.max((matH - 2 * matBorder) / 2, 0.009);
    const matPart = new THREE.Group();
    matPart.name = 'باسبارتو مقطوع بزاوية';
    const matDepth = 0.0018;
    addRail(matPart, [[-mx, my], [mx, my], [aix, aiy], [-aix, aiy]], matDepth, material, 'حافة الباسبارتو العلوية');
    addRail(matPart, [[-aix, -aiy], [aix, -aiy], [mx, -my], [-mx, -my]], matDepth, material, 'حافة الباسبارتو السفلية');
    addRail(matPart, [[-mx, my], [-aix, aiy], [-aix, -aiy], [-mx, -my]], matDepth, material, 'حافة الباسبارتو اليسرى');
    addRail(matPart, [[aix, aiy], [mx, my], [mx, -my], [aix, -aiy]], matDepth, material, 'حافة الباسبارتو اليمنى');
    matPart.position.z = frontZ - 0.005 + 0.002 + exp * 0.052;
    root.add(matPart);
  }

  // 4. Backboard MDF
  if (showBackboard && isVisible('backboard')) {
    const boardZ = -depth / 2 - 0.004 - exp * 0.075;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(outerW - 0.01, 0.01), Math.max(outerH - 0.01, 0.01), 0.0055),
      new THREE.MeshStandardMaterial({ color: '#433c34', roughness: 0.91 }),
    );
    board.position.z = boardZ;
    board.name = 'لوح ظهر MDF — 5.5 مم';
    board.castShadow = true;
    board.receiveShadow = true;
    root.add(board);

    if (showDustSeal) {
      addDustSeal(root, outerW, outerH, boardZ - 0.003);
    }
  }

  // 5. Artwork / Photo Print
  if (showArtwork && isVisible('artwork')) {
    const canvas = createArtwork(frame, photoW, photoH);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    canvas.addEventListener('kadr-image-ready', () => {
      texture.needsUpdate = true;
    });
    const print = new THREE.Mesh(
      new THREE.PlaneGeometry(photoW, photoH),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72, side: THREE.DoubleSide }),
    );
    print.position.z = -depth / 2 + 0.002 + exp * 0.022;
    print.name = frame.imageName ? `الصورة: ${frame.imageName}` : 'طباعة صورة فنية';
    print.userData.partName = 'طباعة الصورة';
    print.receiveShadow = true;
    root.add(print);
  }

  // 6. Polished Glass Front Pane
  if (showGlass && isVisible('glass')) {
    const glassPart = new THREE.Group();
    glassPart.name = 'واجهة زجاجية مصقولة';
    glassPart.position.z = frontZ - 0.002 + exp * 0.098;
    const strength = Math.max(5, Math.min(Number(frame.glassStrength) || 13, 34));
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(innerW * 0.993, 0.01), Math.max(innerH * 0.993, 0.01)),
      new THREE.MeshPhysicalMaterial({
        color: frame.glassTint || '#eef7fb',
        transparent: true,
        opacity: 0.045 + (strength / 100) * 0.68,
        metalness: 0.16,
        roughness: 0.075,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        reflectivity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    pane.name = 'زجاج واجهة مصقول';
    pane.renderOrder = 7;
    pane.castShadow = true;
    glassPart.add(pane);
    addGlassHighlights(glassPart, innerW, innerH, 0.035 + (strength / 100) * 0.62);
    root.add(glassPart);
  }

  // 7. Hanging Hardware
  if (showHardware && isVisible('hardware')) {
    const hardware = new THREE.Group();
    hardware.name = 'إكسسوارات التثبيت';
    hardware.position.z = -exp * 0.045;
    addHardware(hardware, outerW, outerH, depth, exp);
    root.add(hardware);
  }

  // 8. Miter reinforcement splines
  if (showSplines && isVisible('splines')) {
    const splines = new THREE.Group();
    splines.name = 'وصلات تقوية المِيتَر';
    splines.position.z = -exp * 0.045;
    const splineMat = new THREE.MeshStandardMaterial({ color: '#c6a977', roughness: 0.55 });
    const size = Math.min(0.035, outerW / 10, outerH / 10);
    const outerX = outerW / 2;
    const outerY = outerH / 2;
    for (const [x, y, angle] of [
      [-outerX + size * 0.7, -outerY + size * 0.7, -Math.PI / 4],
      [outerX - size * 0.7, -outerY + size * 0.7, Math.PI / 4],
      [-outerX + size * 0.7, outerY - size * 0.7, Math.PI / 4],
      [outerX - size * 0.7, outerY - size * 0.7, -Math.PI / 4],
    ]) {
      const spline = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.22, 0.003), splineMat);
      spline.position.set(x, y, -depth / 2 - 0.008 - exp * 0.032);
      spline.rotation.z = angle;
      spline.name = 'لسان خشبي لتقوية المِيتَر';
      spline.castShadow = true;
      splines.add(spline);
    }
    root.add(splines);
  }

  // Selection outline
  if (selected) {
    const outerX = outerW / 2;
    const outerY = outerH / 2;
    const outlinePoints = [
      [-outerX, -outerY],
      [outerX, -outerY],
      [outerX, outerY],
      [-outerX, outerY],
    ].map(([x, y]) => new THREE.Vector3(x, y, frontZ + 0.007));
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 }),
    );
    outline.renderOrder = 15;
    outline.name = 'حدود العنصر المحدد';
    root.add(outline);
  }

  return root;
}
