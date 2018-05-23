/* global AFRAME AudioContext */
import {ResonanceAudio} from 'resonance-audio'

const log = AFRAME.utils.debug
const warn = log('components:resonance-audio-room:warn')

const RESONANCE_MATERIAL = Object.keys(ResonanceAudio.Utils.ROOM_MATERIAL_COEFFICIENTS)

AFRAME.registerComponent('resonance-audio-room', {
  dependencies: ['geometry', 'position'],
  // To enable multiple instancing on your component,
  // set multiple: true in the component definition:
  multiple: false,

  schema: {
    width: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.width},
    height: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.height},
    depth: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_ROOM_DIMENSIONS.depth},
    ambisonicOrder: {type: 'int', default: ResonanceAudio.Utils.DEFAULT_AMBISONIC_ORDER, oneOf: [1, 3]},
    speedOfSound: {type: 'number', default: ResonanceAudio.Utils.DEFAULT_SPEED_OF_SOUND},
    left: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    right: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    front: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    back: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    down: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL},
    up: {default: 'brick-bare', oneOf: RESONANCE_MATERIAL}
  },
  init () {
    this.builtInGeometry = true
    this.resonanceAudioContext = new AudioContext()
    this.resonanceAudioScene = new ResonanceAudio(this.resonanceAudioContext)
    this.resonanceAudioScene.output.connect(this.resonanceAudioContext.destination)
    
    this.sources = new Array()
    this.setUpAudio()
    this.exposeAPI()
    
    // Update audio source positions on position change.
    this.el.addEventListener('componentchanged', (e) => {
      if (e.detail.name === 'position') {
        this.updatePosition()
        this.sources.forEach(source => source.updatePosition())
      }
    })
    // Correctly handle dynamic attachment and detachment of audio sources.
    this.el.addEventListener('child-attached', (e) => {
      const el = e.detail.el
      if (el.hasLoaded) {
        this.attachSource(el)
      } else {
        el.addEventListener('loaded', e => this.attachSource(el))
      }
    })
    this.el.addEventListener('child-detached', e => this.detachSource(e.detail.el))
  },

  exposeAPI () {
    Object.defineProperties(this.el, {
      // Array of audio source components.
      sources: { enumerable: true, get: () => this.sources },
      // Array of audio sources (HTMLMediaElement and MediaStream objects).
      sounds:  { enumerable: true, get: () => this.sources.map(source => source.el.sound) }
    })
  },

  update (oldData) {
    this.roomSetup(oldData)
    this.acousticsSetup(oldData)
  },

  updatePosition () {
    this.el.object3D.updateMatrixWorld()
  },

  // update resonanceAudioScene after room is tocked
  tock () {
    this.resonanceAudioScene.setListenerFromMatrix(this.el.sceneEl.camera.el.object3D.matrixWorld)
  },

  // room setup
  roomSetup (oldData) {
    // room dimensions
    let dimensions = {
      width: this.data.width,
      height: this.data.height,
      depth: this.data.depth
    }
    if ((this.data.width + this.data.height + this.data.depth) === 0) {
      const bb = new AFRAME.THREE.Box3().setFromObject(this.el.object3D)
      dimensions.width = bb.size().x
      dimensions.height = bb.size().y
      dimensions.depth = bb.size().z
      this.builtInGeometry = false
    }
    // update geometry (only if using default geometry)
    if (this.builtInGeometry) {
      this.el.setAttribute('geometry', dimensions)
    }
    // room materials
    let materials = {
      left: this.data.left,
      right: this.data.right,
      front: this.data.front,
      back: this.data.back,
      down: this.data.down,
      up: this.data.up
    }
    this.resonanceAudioScene.setRoomProperties(dimensions, materials)
  },

  // room acoustics setup
  acousticsSetup (oldData) {
    if (!this.resonanceAudioScene ||
      ((oldData.ambisonicOrder === this.data.ambisonicOrder) &&
      (oldData.speedOfSound === this.data.speedOfSound))) { return }

    this.resonanceAudioScene.setAmbisonicOrder(this.data.ambisonicOrder)
    this.resonanceAudioScene.setSpeedOfSound(this.data.speedOfSound)
  },

  setUpAudio () {
    const children = this.el.object3D.children
    if (children.length < 2) { return }

    // Attach sources.
    children.forEach(childEl => this.attachSource(childEl.el))
  },

  attachSource (el) {
    // Only consider relevant elements.
    if (!el.components['resonance-audio-src']) { return }

    const source = el.components['resonance-audio-src']
    this.sources.push(source)
    source.initAudioSrc(this)
  },

  detachSource (el) {
    const source = el.components['resonance-audio-src']
    if (this.sources.includes(source)) {
      this.sources.splice(this.sources.indexOf(source), 1)
    }
  }
})

AFRAME.registerPrimitive('a-resonance-audio-room', {
  mappings: {
    width: 'resonance-audio-room.width',
    height: 'resonance-audio-room.height',
    depth: 'resonance-audio-room.depth',
    'ambisonic-order': 'resonance-audio-room.ambisonicOrder',
    'speed-of-sound': 'resonance-audio-room.speedOfSound',
    left: 'resonance-audio-room.left',
    right: 'resonance-audio-room.right',
    front: 'resonance-audio-room.front',
    back: 'resonance-audio-room.back',
    down: 'resonance-audio-room.down',
    up: 'resonance-audio-room.up'
  }
})