import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class RoomWalker {
  constructor(camera, canvas, host) {
    this.camera = camera;
    this.canvas = canvas;
    this.host = host;
    this.keys = new Set();
    this.active = false;
    this.drag = null;
    this.pointer = new PointerLockControls(camera, canvas);
    this.pointer.minPolarAngle = 0.15;
    this.pointer.maxPolarAngle = Math.PI - 0.15;
    this.pointer.addEventListener('unlock', () => this.keys.clear());
    canvas.addEventListener('keydown', (event) => {
      if (!this.active || !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(event.code)) return;
      event.preventDefault();
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.keys.clear(); });
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.active || this.pointer.isLocked || event.button !== 0) return;
      canvas.focus();
      this.drag = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.active || !this.drag || this.pointer.isLocked) return;
      this.look((event.clientX - this.drag.x) * 0.004, (event.clientY - this.drag.y) * 0.004);
      this.drag = { x: event.clientX, y: event.clientY };
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, () => { this.drag = null; });
    }
  }

  prepare(model, scale) {
    this.leave();
    this.scale = scale;
    this.radius = 0.18 * scale;
    this.eyeHeight = 1.45 * scale;
    this.bounds = new THREE.Box3().setFromObject(model);
    this.tree = new Octree().fromGraphNode(model);
    this.spawn = this.findSpawn();
    return Boolean(this.spawn);
  }

  floorAt(x, z, fromY) {
    const hit = this.tree.rayIntersect(new THREE.Ray(
      new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0),
    ));
    if (!hit) return null;
    const normal = hit.triangle.getNormal(new THREE.Vector3());
    return normal.y > 0.6 ? hit.position.y : null;
  }

  capsuleAt(position) {
    return new Capsule(
      position.clone().add(new THREE.Vector3(0, this.radius + 0.035 * this.scale, 0)),
      position.clone().add(new THREE.Vector3(0, this.eyeHeight - this.radius, 0)),
      this.radius,
    );
  }

  findSpawn() {
    const candidates = [];
    const size = this.bounds.getSize(new THREE.Vector3());
    for (let i = 1; i < 20; i++) {
      for (let j = 1; j < 20; j++) {
        const x = this.bounds.min.x + size.x * i / 20;
        const z = this.bounds.min.z + size.z * j / 20;
        const floor = this.floorAt(x, z, this.bounds.max.y + this.scale);
        if (floor !== null) candidates.push(new THREE.Vector3(x, floor, z));
      }
    }
    candidates.sort((a, b) => a.y - b.y);
    const floorLevel = candidates[Math.floor(candidates.length * 0.1)]?.y;
    if (floorLevel === undefined) return null;
    const center = this.bounds.getCenter(new THREE.Vector3());
    const suitable = candidates.filter((p) => Math.abs(p.y - floorLevel) < 0.25 * this.scale);
    suitable.sort((a, b) => a.distanceToSquared(center) - b.distanceToSquared(center));
    for (const point of suitable) {
      if (!this.supported(point)) continue;
      const collision = this.tree.capsuleIntersect(this.capsuleAt(point));
      if (!collision || collision.depth < 0.015 * this.scale) return point;
    }
    return null;
  }

  supported(position) {
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const floor = this.floorAt(
        position.x + dx * this.radius * 0.8,
        position.z + dz * this.radius * 0.8,
        position.y + 0.25 * this.scale,
      );
      if (floor === null || Math.abs(floor - position.y) > 0.2 * this.scale) return false;
    }
    return true;
  }

  enter() {
    if (!this.spawn) return false;
    this.active = true;
    this.reset();
    this.canvas.focus();
    return true;
  }

  reset() {
    if (!this.spawn) return;
    this.keys.clear();
    this.position = this.spawn.clone();
    this.camera.fov = 70;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.eyeHeight, 0));
    let bestYaw = 0;
    let bestSpace = -1;
    for (let i = 0; i < 24; i++) {
      const yaw = i * Math.PI / 12;
      let space = 0;
      let surfaces = 0;
      for (const offset of [-0.2, 0, 0.2]) {
        const direction = new THREE.Vector3(-Math.sin(yaw + offset), 0, -Math.cos(yaw + offset));
        const hit = this.tree.rayIntersect(new THREE.Ray(this.camera.position, direction));
        if (hit) {
          surfaces++;
          space += Math.min(hit.distance, 6 * this.scale);
        }
      }
      if (surfaces < 3) continue;
      if (space > bestSpace) {
        bestSpace = space;
        bestYaw = yaw;
      }
    }
    this.camera.rotation.set(-0.12, bestYaw, 0, 'YXZ');
    this.publish();
  }

  leave() {
    this.active = false;
    this.keys.clear();
    this.drag = null;
    if (this.pointer.isLocked) this.pointer.unlock();
  }

  look(yaw, pitch = 0) {
    const rotation = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    rotation.y -= yaw;
    rotation.x = THREE.MathUtils.clamp(rotation.x - pitch, -1.4, 1.4);
    this.camera.quaternion.setFromEuler(rotation);
  }

  move(delta) {
    const desired = this.position.clone().add(delta);
    const capsule = this.capsuleAt(desired);
    for (let iteration = 0; iteration < 4; iteration++) {
      const collision = this.tree.capsuleIntersect(capsule);
      if (!collision) break;
      const push = collision.normal.multiplyScalar(collision.depth + 0.0001);
      capsule.translate(push);
      desired.add(push);
    }
    const floor = this.floorAt(desired.x, desired.z, this.position.y + 0.25 * this.scale);
    if (floor === null || Math.abs(floor - this.position.y) > 0.2 * this.scale) return;
    desired.y = floor;
    if (!this.supported(desired)) return;
    const remaining = this.tree.capsuleIntersect(this.capsuleAt(desired));
    if (remaining && remaining.depth > 0.02 * this.scale) return;
    this.position.copy(desired);
  }

  update(delta) {
    if (!this.active || !this.position) return;
    if (this.keys.has('ArrowLeft')) this.look(-delta * 1.5);
    if (this.keys.has('ArrowRight')) this.look(delta * 1.5);
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    const movement = new THREE.Vector3();
    if (this.keys.has('KeyW')) movement.add(forward);
    if (this.keys.has('KeyS')) movement.sub(forward);
    if (this.keys.has('KeyD')) movement.add(right);
    if (this.keys.has('KeyA')) movement.sub(right);
    if (movement.lengthSq()) {
      const steps = Math.max(1, Math.ceil(delta / 0.016));
      movement.normalize().multiplyScalar(1.1 * this.scale * delta / steps);
      for (let i = 0; i < steps; i++) this.move(movement);
    }
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, this.eyeHeight, 0));
    this.publish();
  }

  publish() {
    this.host.dataset.position = this.position.toArray().map((n) => n.toFixed(4)).join(',');
    this.host.dataset.heading = this.camera.rotation.y.toFixed(4);
  }
}
