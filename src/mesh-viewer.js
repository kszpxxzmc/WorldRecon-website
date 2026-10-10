import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoomWalker } from './room-walker.js';

export class MeshViewer {
  constructor(host) {
    this.host = host;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8f9fa);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive reconstructed scene mesh');
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minPolarAngle = 0.12;
    this.controls.autoRotateSpeed = 0.8;
    this.walker = new RoomWalker(this.camera, this.renderer.domElement, host);
    this.mode = 'overview';
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9b9a93, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 8, 5);
    this.scene.add(sun);
    this.draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    this.draco.setWorkerLimit(2);
    this.loader = new GLTFLoader().setDRACOLoader(this.draco);
    this.request = 0;
    this.visible = true;
    this.clock = new THREE.Clock();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (!this.visible) this.walker.keys.clear();
    });
    this.visibilityObserver.observe(host);
    this.renderer.setAnimationLoop(() => {
      const delta = Math.min(this.clock.getDelta(), 0.1);
      if (!this.visible || document.hidden) return;
      if (this.mode === 'walk') this.walker.update(delta);
      else this.controls.update(delta);
      this.renderer.render(this.scene, this.camera);
    });
    this.renderer.domElement.addEventListener('keydown', (event) => {
      if (this.mode === 'walk') return;
      if (event.key === 'Home') this.reset();
      else if (event.key === '+' || event.key === '=') this.zoom(0.85);
      else if (event.key === '-') this.zoom(1.18);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const offset = this.camera.position.clone().sub(this.controls.target);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), event.key === 'ArrowLeft' ? 0.16 : -0.16);
        this.camera.position.copy(this.controls.target).add(offset);
      } else return;
      event.preventDefault();
    });
    this.renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      host.dataset.state = 'error';
      this.onError?.('3D display interrupted. Reload the scene to continue.');
    });
  }

  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  async load(url, sceneId, { navigation = true } = {}) {
    const request = ++this.request;
    this.host.dataset.state = 'loading';
    delete this.host.dataset.scene;
    this.walker.leave();
    this.walker.tree = null;
    this.walker.spawn = null;
    this.mode = 'overview';
    this.controls.enabled = true;
    if (this.model) {
      this.scene.remove(this.model);
      this.disposeModel(this.model);
      this.model = null;
    }
    try {
      const gltf = await this.loader.loadAsync(url, (event) => {
        if (request === this.request) this.onProgress?.(event.total ? event.loaded / event.total : null);
      });
      if (request !== this.request) {
        this.disposeModel(gltf.scene);
        return;
      }
      this.model = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const scale = 6 / Math.max(size.x, size.y, size.z);
      this.model.scale.multiplyScalar(scale);
      this.model.position.sub(center.multiplyScalar(scale));
      this.model.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          material.side = THREE.DoubleSide;
          material.envMapIntensity = 0.6;
        }
      });
      this.scene.add(this.model);
      this.bounds = new THREE.Box3().setFromObject(this.model);
      this.onProgress?.(null, 'Preparing navigation…');
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (request !== this.request) return;
      const walkable = navigation ? this.walker.prepare(this.model, scale) : false;
      this.host.dataset.walkable = String(walkable);
      this.resize();
      this.reset();
      this.host.dataset.state = 'ready';
      this.host.dataset.scene = sceneId;
      this.onReady?.();
    } catch (error) {
      if (request !== this.request) return;
      this.host.dataset.state = 'error';
      this.onError?.('Mesh could not be loaded.');
      console.error('Scene mesh load failed', error);
    }
  }

  reset() {
    if (this.mode === 'walk') {
      this.walker.reset();
      return;
    }
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const direction = new THREE.Vector3(0.5, Math.sqrt(3) / 2, 0);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right);
    let distance = 1;
    if (this.bounds) {
      for (const x of [this.bounds.min.x, this.bounds.max.x]) {
        for (const y of [this.bounds.min.y, this.bounds.max.y]) {
          for (const z of [this.bounds.min.z, this.bounds.max.z]) {
            const point = new THREE.Vector3(x, y, z);
            distance = Math.max(distance,
              point.dot(direction) + Math.abs(point.dot(right)) / (Math.tan(fov / 2) * this.camera.aspect),
              point.dot(direction) + Math.abs(point.dot(up)) / Math.tan(fov / 2));
          }
        }
      }
    }
    distance *= 1.12;
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(direction.multiplyScalar(distance));
    this.controls.minDistance = distance * 0.32;
    this.controls.maxDistance = distance * 2.2;
    this.controls.update();
  }

  zoom(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(distance));
    this.controls.update();
  }

  setMode(mode) {
    if (mode === 'walk' && !this.walker.spawn) return false;
    this.walker.leave();
    this.mode = mode;
    this.host.dataset.mode = mode;
    this.controls.enabled = mode === 'overview';
    if (mode === 'walk') this.walker.enter();
    else this.reset();
    return true;
  }

  disposeModel(root) {
    const textures = new Set();
    root.traverse((object) => {
      object.geometry?.dispose();
      if (!object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        material.dispose();
      }
    });
    textures.forEach((texture) => texture.dispose());
  }
}
