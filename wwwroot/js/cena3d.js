const canvas = document.querySelector('#cena3d');
let ativo = true;
let renderer, scene, camera, relogio, grupoMundo, grupoLivros, grupoPaginas, armilar, particulas;
let mouseX = 0, mouseY = 0, alvoX = 0, alvoY = 0;

window.addEventListener('biblioteca:movimento', e => ativo = Boolean(e.detail));

async function iniciar() {
  try {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    construir(THREE);
  } catch (erro) {
    canvas.style.background = 'radial-gradient(circle at 50% 20%, #214b3f 0%, #0d2a23 35%, #061612 72%, #020a08 100%)';
  }
}

function construir(THREE) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.25 : 1.7));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x071c17, .028);
  camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 120);
  camera.position.set(0, 2.2, 15.5);
  relogio = new THREE.Clock();

  const hemi = new THREE.HemisphereLight(0x8db7a9, 0x160d08, 1.2);
  scene.add(hemi);
  const luzQuente = new THREE.PointLight(0xffc66e, 45, 32, 2);
  luzQuente.position.set(-4, 5, 6);
  scene.add(luzQuente);
  const luzQuente2 = new THREE.PointLight(0xffa34a, 22, 26, 2);
  luzQuente2.position.set(6, -1, 3);
  scene.add(luzQuente2);
  const luzFria = new THREE.DirectionalLight(0x83c9bb, 2.4);
  luzFria.position.set(2, 6, 10);
  scene.add(luzFria);

  grupoMundo = new THREE.Group();
  scene.add(grupoMundo);

  const materialMadeira = new THREE.MeshStandardMaterial({ color:0x17110c, roughness:.82, metalness:.12 });
  const materialOuro = new THREE.MeshStandardMaterial({ color:0xa98947, roughness:.32, metalness:.78 });
  const materialVerde = new THREE.MeshStandardMaterial({ color:0x10352b, roughness:.66, metalness:.18 });
  const materialPapel = new THREE.MeshStandardMaterial({ color:0xe6d9bd, roughness:.9, side:THREE.DoubleSide });

  for (const lado of [-1, 1]) {
    const estante = new THREE.Group();
    estante.position.x = lado * 8.2;
    estante.position.z = -1.5;
    for (let andar=0; andar<5; andar++) {
      const prateleira = new THREE.Mesh(new THREE.BoxGeometry(4.2,.18,2.3), materialMadeira);
      prateleira.position.set(0, andar*2.1-4.2, 0);
      estante.add(prateleira);
      for (let i=0;i<10;i++) {
        const largura = .16 + Math.random()*.16;
        const altura = .85 + Math.random()*.8;
        const livro = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, .72), i%4===0 ? materialVerde : materialMadeira);
        livro.position.set(-1.75 + i*.38, andar*2.1-3.55 + (altura-.9)/2, .15 + Math.random()*.2);
        livro.rotation.z = (Math.random()-.5)*.08;
        estante.add(livro);
      }
    }
    const coluna = new THREE.Mesh(new THREE.CylinderGeometry(.22,.3,12,20), materialOuro);
    coluna.position.set(-lado*1.95, .7, .65);
    estante.add(coluna);
    grupoMundo.add(estante);
  }

  for (let i=0;i<4;i++) {
    const arco = new THREE.Mesh(new THREE.TorusGeometry(5.8 + i*.85,.075,8,90,Math.PI), materialOuro);
    arco.position.set(0, -2 + i*1.65, -4 - i*1.45);
    arco.rotation.z = Math.PI;
    arco.rotation.x = .13*i;
    grupoMundo.add(arco);
  }

  armilar = new THREE.Group();
  armilar.position.set(5.8,2.7,-2.4);
  [0,Math.PI/2,Math.PI/4].forEach((r,i)=>{
    const anel = new THREE.Mesh(new THREE.TorusGeometry(1.35+i*.12,.035,8,70), materialOuro);
    anel.rotation.x = r;
    anel.rotation.y = r*.7;
    armilar.add(anel);
  });
  const globo = new THREE.Mesh(new THREE.SphereGeometry(.7,32,24), new THREE.MeshStandardMaterial({ color:0x133c32, roughness:.58, metalness:.25 }));
  armilar.add(globo);
  grupoMundo.add(armilar);

  grupoLivros = new THREE.Group();
  const cores = [0x153c32,0x2b1b12,0x5d3223,0x10251f];
  for (let i=0;i<20;i++) {
    const livro = new THREE.Mesh(new THREE.BoxGeometry(.75+Math.random()*.6,.11+Math.random()*.08,1.05+Math.random()*.65), new THREE.MeshStandardMaterial({ color:cores[i%cores.length], roughness:.68, metalness:.12 }));
    livro.position.set((Math.random()-.5)*13, (Math.random()-.25)*9, -2-Math.random()*14);
    livro.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    livro.userData = { velocidade:.08+Math.random()*.18, fase:Math.random()*Math.PI*2, baseY:livro.position.y };
    grupoLivros.add(livro);
  }
  grupoMundo.add(grupoLivros);

  grupoPaginas = new THREE.Group();
  for (let i=0;i<28;i++) {
    const folha = new THREE.Mesh(new THREE.PlaneGeometry(.55+Math.random()*.6,.75+Math.random()*.7,1,1), materialPapel.clone());
    folha.material.opacity = .52 + Math.random()*.35;
    folha.material.transparent = true;
    folha.position.set((Math.random()-.5)*15,(Math.random()-.5)*10,-2-Math.random()*15);
    folha.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    folha.userData = { velocidade:.13+Math.random()*.25, fase:Math.random()*6.28, baseX:folha.position.x };
    grupoPaginas.add(folha);
  }
  grupoMundo.add(grupoPaginas);

  const geoPart = new THREE.BufferGeometry();
  const count = innerWidth < 700 ? 500 : 1200;
  const pos = new Float32Array(count*3);
  for (let i=0;i<count;i++) {
    pos[i*3]=(Math.random()-.5)*28;
    pos[i*3+1]=(Math.random()-.5)*18;
    pos[i*3+2]=-Math.random()*28;
  }
  geoPart.setAttribute('position', new THREE.BufferAttribute(pos,3));
  particulas = new THREE.Points(geoPart,new THREE.PointsMaterial({color:0xdac485,size:.035,transparent:true,opacity:.65,sizeAttenuation:true}));
  scene.add(particulas);

  window.addEventListener('pointermove', e => {
    alvoX = (e.clientX/innerWidth-.5)*2;
    alvoY = (e.clientY/innerHeight-.5)*2;
  }, { passive:true });
  window.addEventListener('resize', redimensionar);
  animar(THREE);
}

function redimensionar() {
  if (!renderer || !camera) return;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}

function animar(THREE) {
  requestAnimationFrame(() => animar(THREE));
  if (!renderer || !scene || !camera) return;
  if (!ativo || document.hidden) { renderer.render(scene,camera); return; }
  const t = relogio.getElapsedTime();
  mouseX += (alvoX-mouseX)*.035;
  mouseY += (alvoY-mouseY)*.035;
  const scroll = Math.min(1.5, scrollY/900);
  camera.position.x = mouseX*1.15;
  camera.position.y = 2.2 - mouseY*.65 - scroll*.45;
  camera.position.z = 15.5 + scroll*1.5;
  camera.lookAt(mouseX*.18, .4-mouseY*.1, -3.8);
  if (armilar) {
    armilar.rotation.y = t*.13;
    armilar.rotation.x = Math.sin(t*.2)*.08;
  }
  grupoLivros?.children.forEach((livro,i)=>{
    livro.rotation.y += livro.userData.velocidade*.005;
    livro.rotation.x += .0012;
    livro.position.y = livro.userData.baseY + Math.sin(t*livro.userData.velocidade + livro.userData.fase)*.45;
    livro.position.x += Math.sin(t*.13+i)*.0009;
  });
  grupoPaginas?.children.forEach((folha,i)=>{
    folha.rotation.y += .002 + folha.userData.velocidade*.002;
    folha.rotation.z += Math.sin(t*.3+i)*.0015;
    folha.position.y += Math.sin(t*.4+folha.userData.fase)*.002;
    folha.position.x = folha.userData.baseX + Math.sin(t*.18+folha.userData.fase)*.6;
  });
  if (particulas) {
    particulas.rotation.y = t*.008;
    particulas.rotation.x = Math.sin(t*.07)*.02;
  }
  renderer.render(scene,camera);
}

iniciar();
