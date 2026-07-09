import * as PIXI from 'pixi.js'
import { Tilemap } from './Tilemap'
import { SpriteManager } from './SpriteManager'
import { LightingSystem } from './LightingSystem'
import { ParticleSystem } from './ParticleSystem'
import { StatusIndicators } from './StatusIndicators'

// Píxeles por unidad de mundo (una casilla de terreno). El backend expresa las
// posiciones en unidades de casilla; el terreno se dibuja a TILE px por casilla,
// así que hay que escalar NPCs/edificios por TILE para que todo quede alineado.
const TILE = 16

// Tamaño total del mundo en casillas (debe coincidir con el terreno del backend).
const WORLD_W = 200
const WORLD_H = 150

/**
 * Escena principal del juego que gestiona todas las capas de renderizado,
 * la cámara y la actualización de entidades.
 */
export class GameScene {
  /**
   * @param {React.RefObject} canvasRef - Referencia al elemento canvas
   * @param {Object|null} terrainData - Datos del terreno generado
   */
  constructor (canvasRef, terrainData) {
    if (!canvasRef?.current) {
      throw new Error('Canvas reference is required')
    }

    this.app = new PIXI.Application({
      view: canvasRef.current,
      width: canvasRef.current.parentElement?.clientWidth || 800,
      height: canvasRef.current.parentElement?.clientHeight || 600,
      backgroundColor: 0x000000,
      antialias: false,
      resolution: globalThis.devicePixelRatio > 1 ? 2 : 1,
      autoDensity: true
    })

    // Capas en orden z
    this.groundLayer = new PIXI.Container()
    this.buildingLayer = new PIXI.Container()
    this.linkLayer = new PIXI.Container() // líneas de interacción social (bajo los NPCs)
    this.npcLayer = new PIXI.Container()
    this.effectLayer = new PIXI.Container()
    this.fogLayer = new PIXI.Container() // niebla del área no explorada
    this.uiLayer = new PIXI.Container()
    this.lightingOverlay = new PIXI.Container()

    this.app.stage.addChild(
      this.groundLayer,
      this.buildingLayer,
      this.linkLayer,
      this.npcLayer,
      this.effectLayer,
      this.fogLayer,
      this.uiLayer,
      this.lightingOverlay
    )

    // Inicializar sistemas
    this.tilemap = new Tilemap(this.groundLayer, terrainData)
    this.spriteManager = new SpriteManager()
    this.lighting = new LightingSystem(
      this.lightingOverlay,
      this.app.screen.width,
      this.app.screen.height
    )
    this.particles = new ParticleSystem(this.effectLayer)
    this.indicators = new StatusIndicators(this.uiLayer)

    // Gráfico persistente para las líneas de interacción social (no se destruye por frame).
    this.socialLinkGfx = new PIXI.Graphics()
    this.socialLinkGfx.eventMode = 'none' // decorativo: nunca debe capturar clics
    this.linkLayer.addChild(this.socialLinkGfx)

    // Niebla del área no explorada (se recalcula al cambiar los límites del mundo).
    this.fogGfx = new PIXI.Graphics()
    this.fogGfx.eventMode = 'none' // cubre gran parte del mundo: no debe bloquear clics
    this.fogLayer.addChild(this.fogGfx)
    this.worldPxW = WORLD_W * TILE
    this.worldPxH = WORLD_H * TILE

    // Estado interno
    this.npcSprites = new Map()
    this.npcLabels = new Map() // id -> PIXI.Text con el nombre
    this.buildingGraphics = new Map()
    this.prevNPCStates = new Map()

    // Cámara (en unidades de casilla; se convierte a px en updateTransform).
    this.camera = { x: 100, y: 80, zoom: 2 }
    this._cameraCentered = false // se auto-centra en los NPCs al recibir datos

    // Binding de métodos ANTES de registrar los listeners. Si se hace después,
    // addEventListener guarda las versiones SIN bindear y, al dispararse el evento,
    // `this` apunta al canvas/window en vez de a la escena → el arrastre y el zoom
    // no funcionan (era justo el bug de "no me puedo mover en el mapa").
    this._onMouseDown = this._onMouseDown.bind(this)
    this._onMouseUp = this._onMouseUp.bind(this)
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onWheel = this._onWheel.bind(this)
    this._onTouchStart = this._onTouchStart.bind(this)
    this._onTouchEnd = this._onTouchEnd.bind(this)
    this._onTouchMove = this._onTouchMove.bind(this)

    this._setupCamera()

    // Aplicar la transformación inicial de cámara.
    this.updateTransform()

    // Referencia para depuración desde DevTools:
    //   document.querySelector('canvas').__scene.camera
    canvasRef.current.__scene = this
  }

  /**
   * Configura los eventos de cámara (arrastre y zoom).
   * @private
   */
  _setupCamera () {
    const view = this.app.view

    this._dragging = false
    this._lastPos = { x: 0, y: 0 }

    view.addEventListener('mousedown', this._onMouseDown)
    globalThis.addEventListener('mouseup', this._onMouseUp)
    globalThis.addEventListener('mousemove', this._onMouseMove)
    view.addEventListener('wheel', this._onWheel, { passive: false })

    // Eventos táctiles para dispositivos móviles (ya bindeados en el constructor)
    view.addEventListener('touchstart', this._onTouchStart, { passive: false })
    globalThis.addEventListener('touchend', this._onTouchEnd)
    globalThis.addEventListener('touchmove', this._onTouchMove, { passive: false })
  }

  /** @private */
  _onMouseDown (e) {
    this._dragging = true
    this._lastPos = { x: e.clientX, y: e.clientY }
  }

  /** @private */
  _onMouseUp () {
    this._dragging = false
  }

  /** @private */
  _onMouseMove (e) {
    if (!this._dragging) return
    this._updateCameraPosition(e.clientX, e.clientY)
  }

  /** @private */
  _onWheel (e) {
    e.preventDefault()
    this.camera.zoom = Math.max(
      0.3, // permite alejarse para ver la frontera explorada y la niebla
      Math.min(5, this.camera.zoom - e.deltaY * 0.002)
    )
    this.updateTransform()
  }

  /** @private */
  _onTouchStart (e) {
    if (e.touches.length === 1) {
      e.preventDefault()
      this._dragging = true
      this._lastPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }

  /** @private */
  _onTouchEnd () {
    this._dragging = false
  }

  /** @private */
  _onTouchMove (e) {
    if (!this._dragging || e.touches.length !== 1) return
    e.preventDefault()
    this._updateCameraPosition(e.touches[0].clientX, e.touches[0].clientY)
  }

  /** @private */
  _updateCameraPosition (clientX, clientY) {
    // El delta del ratón está en px de pantalla; la cámara está en casillas.
    this.camera.x -= (clientX - this._lastPos.x) / (this.camera.zoom * TILE)
    this.camera.y -= (clientY - this._lastPos.y) / (this.camera.zoom * TILE)
    this._lastPos = { x: clientX, y: clientY }
    this.updateTransform()
  }

  /**
   * Actualiza la transformación del stage según la cámara.
   */
  updateTransform () {
    const stage = this.app.stage
    stage.scale.set(this.camera.zoom)
    // La cámara está en casillas; el mundo se dibuja en px (casilla * TILE).
    stage.position.set(
      this.app.screen.width / 2 - this.camera.x * TILE * this.camera.zoom,
      this.app.screen.height / 2 - this.camera.y * TILE * this.camera.zoom
    )
  }

  /**
   * Carga (o recarga) el terreno. Necesario porque el terreno llega por WebSocket
   * DESPUÉS de construir la escena, así que no está disponible en el constructor.
   * @param {Object} terrainData - Datos del terreno generado
   */
  setTerrain (terrainData) {
    if (terrainData) {
      this.tilemap.loadFromData(terrainData)
      this.worldPxW = (terrainData.width || WORLD_W) * TILE
      this.worldPxH = (terrainData.height || WORLD_H) * TILE
    }
  }

  /**
   * Actualiza la escena con el estado actual del mundo.
   * @param {Object} worldState - Estado del mundo
   * @param {Function} onSelectNPC - Callback al seleccionar NPC
   * @param {string} timeStr - Hora actual (HH:MM)
   * @param {string} [weather] - Clima actual
   */
  update (worldState, onSelectNPC, timeStr, weather, worldBounds) {
    if (!worldState) return

    this._autoCenterCamera(worldState)
    this._updateBuildings(worldState, onSelectNPC)
    this._updateNPCs(worldState, onSelectNPC)
    this._updateFog(worldBounds)
    this._updateLighting(timeStr, weather)

    // Actualizar partículas
    this.particles.update()
  }

  /**
   * Oscurece el área NO explorada (fuera de los límites del mundo). A medida que
   * crece la población, los límites se expanden y la niebla se retira → sensación
   * de exploración.
   * @private
   */
  _updateFog (bounds) {
    const g = this.fogGfx
    g.clear()
    if (!bounds) return
    const W = this.worldPxW
    const H = this.worldPxH
    const x0 = bounds.minX * TILE
    const x1 = bounds.maxX * TILE
    const y0 = bounds.minY * TILE
    const y1 = bounds.maxY * TILE

    g.beginFill(0x0a0e18, 0.72)
    g.drawRect(0, 0, W, y0) // arriba
    g.drawRect(0, y1, W, H - y1) // abajo
    g.drawRect(0, y0, x0, y1 - y0) // izquierda
    g.drawRect(x1, y0, W - x1, y1 - y0) // derecha
    g.endFill()

    // Borde tenue de la frontera explorada
    g.lineStyle(2, 0xffe08a, 0.18)
    g.drawRect(x0, y0, x1 - x0, y1 - y0)
  }

  /**
   * Actualiza los sprites de edificios.
   * @private
   */
  _updateBuildings (worldState, onSelectNPC) {
    const buildings = worldState.getBuildings()
    const currentBuildingIds = new Set(buildings.map(b => b.id))

    buildings.forEach(b => {
      let graphic = this.buildingGraphics.get(b.id)
      if (!graphic) {
        graphic = this._createBuildingGraphic(b)
        graphic.eventMode = 'static'
        graphic.cursor = 'pointer'
        graphic.on('click', () => onSelectNPC(null))
        this.buildingLayer.addChild(graphic)
        this.buildingGraphics.set(b.id, graphic)
      }
      graphic.x = (b.Position?.x ?? 0) * TILE
      graphic.y = (b.Position?.y ?? 0) * TILE
    })

    // Eliminar gráficos huérfanos
    this.buildingGraphics.forEach((graphic, id) => {
      if (!currentBuildingIds.has(id)) {
        graphic.removeFromParent()
        graphic.destroy()
        this.buildingGraphics.delete(id)
      }
    })
  }

  /**
   * Actualiza los sprites de NPCs.
   * @private
   */
  _updateNPCs (worldState, onSelectNPC) {
    const npcs = worldState.getNPCs()
    const currentNpcIds = new Set(npcs.map(n => n.id))

    npcs.forEach(npc => {
      let sprite = this.npcSprites.get(npc.id)
      if (!sprite) {
        const variant = this._getSpriteVariant(npc)
        sprite = this.spriteManager.createNPCSprite(variant)
        sprite.eventMode = 'static'
        sprite.cursor = 'pointer'
        // Pasar el id (no el objeto) para que el panel muestre datos EN VIVO.
        const id = npc.id
        sprite.on('click', () => onSelectNPC(id))
        this.npcLayer.addChild(sprite)
        this.npcSprites.set(npc.id, sprite)

        // Etiqueta con el nombre encima de la cabeza
        const label = new PIXI.Text(npc.Identity?.name || `#${npc.id}`, {
          fontFamily: 'monospace',
          fontSize: 8,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 3,
          align: 'center'
        })
        label.anchor.set(0.5, 1)
        this.uiLayer.addChild(label)
        this.npcLabels.set(npc.id, label)
      }

      // Posición (px = casilla * TILE, para alinear con el terreno)
      sprite.x = (npc.Position?.x ?? 0) * TILE
      sprite.y = (npc.Position?.y ?? 0) * TILE

      // Animación según acción y dirección
      const action = npc.ActionState?.action || 'idle'
      const facing = npc.ActionState?.facing || 'down'
      const moving = action.includes('moving')
      const anim = moving ? 'walk' : 'idle'
      this.spriteManager.setAnimation(sprite, anim, facing)

      // Tinte según emoción (más feliz = más vibrante)
      if (npc.Emotions) {
        const hap = (npc.Emotions.happiness ?? 50) / 100
        const r = Math.min(1, hap * 0.4 + 0.6)
        const g = Math.min(1, hap * 0.6 + 0.4)
        const b = Math.min(1, hap * 0.5 + 0.3)
        sprite.tint =
          (Math.floor(r * 255) << 16) |
          (Math.floor(g * 255) << 8) |
          Math.floor(b * 255)
      }

      // Efectos de partículas al cambiar de acción
      const prev = this.prevNPCStates.get(npc.id) || {}
      if (prev.action === 'socializing' && action !== 'socializing') {
        this.particles.emitHearts(sprite.x, sprite.y - 20)
      }
      if (action === 'buying_food' && prev.action !== 'buying_food') {
        this.particles.emitFood(sprite.x, sprite.y - 15)
      }
      if (action === 'working' && prev.action !== 'working') {
        this.particles.emitWork(sprite.x, sprite.y - 20)
      }
      this.prevNPCStates.set(npc.id, { action })

      // Indicadores de estado
      this.indicators.update(npc.id, {
        x: sprite.x,
        y: sprite.y - 30,
        hunger: npc.Needs?.hunger,
        energy: npc.Needs?.energy,
        sick: npc.Health?.is_sick,
        socializing: action === 'socializing'
      })

      // Reposicionar la etiqueta de nombre sobre la cabeza
      const label = this.npcLabels.get(npc.id)
      if (label) {
        label.x = sprite.x
        label.y = sprite.y - 34
      }
    })

    // Líneas de interacción social (NPCs charlando entre sí)
    this._drawSocialLinks(npcs)

    // Eliminar sprites/etiquetas huérfanos
    this.npcSprites.forEach((sprite, id) => {
      if (!currentNpcIds.has(id)) {
        sprite.removeFromParent()
        sprite.destroy()
        this.npcSprites.delete(id)
        this.indicators.remove(id)
        const label = this.npcLabels.get(id)
        if (label) {
          label.removeFromParent()
          label.destroy()
          this.npcLabels.delete(id)
        }
      }
    })
  }

  /**
   * Centra la cámara en el centroide de los NPCs la primera vez que hay datos,
   * para enmarcar la zona poblada sin depender de la posición aleatoria del mundo.
   * @private
   */
  _autoCenterCamera (worldState) {
    if (this._cameraCentered) return
    const npcs = worldState.getNPCs()
    if (npcs.length === 0) return
    let sx = 0; let sy = 0; let n = 0
    npcs.forEach(npc => {
      if (npc.Position) {
        sx += npc.Position.x
        sy += npc.Position.y
        n++
      }
    })
    if (n === 0) return
    this.camera.x = sx / n
    this.camera.y = sy / n
    this._cameraCentered = true
    this.updateTransform()
  }

  /**
   * Dibuja una línea entre cada NPC que está socializando y su interlocutor,
   * para que se vea que están interactuando entre sí.
   * @private
   */
  _drawSocialLinks (npcs) {
    const g = this.socialLinkGfx
    g.clear()
    npcs.forEach(npc => {
      if ((npc.ActionState?.action) !== 'socializing') return
      const targetId = npc.ActionState?.target_entity
      if (targetId == null) return
      const a = this.npcSprites.get(npc.id)
      const b = this.npcSprites.get(targetId)
      if (!a || !b) return
      g.lineStyle(1, 0xffee88, 0.7)
      g.moveTo(a.x, a.y - 12)
      g.lineTo(b.x, b.y - 12)
    })
  }

  /**
   * Actualiza la iluminación según la hora y el clima.
   * @private
   */
  _updateLighting (timeStr, weather) {
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number)
      let hour = h + (m ?? 0) / 60

      // Ajustar por clima
      if (weather === 'storm') {
        hour = Math.max(20, hour) // Más oscuro durante tormenta
      }

      this.lighting.update(hour)
    }
  }

  /**
   * Obtiene la variante de sprite según el nombre del NPC.
   * @private
   */
  _getSpriteVariant (npc) {
    const name = npc?.Identity?.name || ''
    if (name.length === 0) return 0
    return name.codePointAt(0) % 4
  }

  /**
   * Crea un gráfico para un edificio.
   * @private
   */
  _createBuildingGraphic (building) {
    const type = building?.Building?.building_type || 'house'
    const g = new PIXI.Graphics()

    // Sombra al pie (da sensación de volumen)
    g.beginFill(0x000000, 0.22)
    g.drawEllipse(0, 16, 15, 4)
    g.endFill()

    const drawers = {
      hospital: this._drawHospital,
      school: this._drawSchool,
      farm: this._drawFarm,
      office: this._drawOffice,
      shop: this._drawShop,
      house: this._drawHouse
    }
    ;(drawers[type] || this._drawHouse).call(this, g)

    // Etiqueta con el nombre bajo el edificio
    const name = building?.Building?.name || type
    const text = new PIXI.Text(name.substring(0, 14), {
      fontSize: 7,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 3,
      align: 'center',
      fontFamily: 'monospace'
    })
    text.anchor.set(0.5, 0)
    text.y = 20
    g.addChild(text)

    return g
  }

  /** Casa: paredes, tejado a dos aguas, puerta, ventanas y chimenea. @private */
  _drawHouse (g) {
    g.beginFill(0xd8b483); g.drawRect(-12, 0, 24, 16); g.endFill() // pared
    g.beginFill(0x8a5a44); g.drawRect(6, -12, 4, 7); g.endFill() // chimenea
    g.beginFill(0xa5432f); g.drawPolygon([-15, 0, 0, -13, 15, 0]); g.endFill() // tejado
    g.beginFill(0x8f3524); g.drawPolygon([-15, 0, 0, -13, -13, 0]); g.endFill() // sombra tejado
    g.beginFill(0x6b4626); g.drawRect(-3, 7, 7, 9); g.endFill() // puerta
    g.beginFill(0xffcf5a); g.drawRect(2, 11, 1.2, 1.2); g.endFill() // pomo
    g.beginFill(0x9fdcf0); g.drawRect(-10, 4, 5, 5); g.drawRect(6, 4, 5, 5); g.endFill() // ventanas
    g.beginFill(0x5a4a3a) // marcos
    g.drawRect(-7.75, 4, 0.5, 5); g.drawRect(-10, 6.25, 5, 0.5)
    g.drawRect(8.25, 4, 0.5, 5); g.drawRect(6, 6.25, 5, 0.5)
    g.endFill()
  }

  /** Hospital: cuerpo blanco, banda roja, cruz y entrada acristalada. @private */
  _drawHospital (g) {
    g.beginFill(0xeef2f6); g.drawRect(-13, -4, 26, 20); g.endFill() // cuerpo
    g.beginFill(0xd23b3b); g.drawRect(-13, -8, 26, 4); g.endFill() // banda de techo
    g.beginFill(0xd23b3b); g.drawRect(-2, -1, 4, 9); g.drawRect(-5, 2, 10, 3); g.endFill() // cruz
    g.beginFill(0x9fdcf0); g.drawRect(-11, 2, 5, 5); g.drawRect(6, 2, 5, 5); g.endFill() // ventanas
    g.beginFill(0x8fb8d8); g.drawRect(-4, 9, 8, 7); g.endFill() // entrada
  }

  /** Escuela: ladrillo, campanario con tejado, ventanas y puerta. @private */
  _drawSchool (g) {
    g.beginFill(0xcf7a3c); g.drawRect(-14, -2, 28, 18); g.endFill() // ladrillo
    g.beginFill(0x7a3b1e); g.drawRect(-15, -5, 30, 4); g.endFill() // cornisa
    g.beginFill(0xdf8a44); g.drawRect(-3, -15, 6, 11); g.endFill() // torre
    g.beginFill(0x7a3b1e); g.drawPolygon([-5, -15, 0, -22, 5, -15]); g.endFill() // tejado torre
    g.beginFill(0xffcf5a); g.drawRect(-1.5, -12, 3, 3); g.endFill() // campana
    g.beginFill(0x9fdcf0); g.drawRect(-11, 3, 5, 6); g.drawRect(6, 3, 5, 6); g.endFill() // ventanas
    g.beginFill(0x5a3a1e); g.drawRect(-3, 8, 7, 8); g.endFill() // puerta
  }

  /** Granja: granero rojo con tejado gambrel y silo. @private */
  _drawFarm (g) {
    g.beginFill(0xc3cace); g.drawRect(9, -6, 8, 22); g.endFill() // silo
    g.beginFill(0x9aa2a8); g.drawPolygon([9, -6, 13, -11, 17, -6]); g.endFill() // cúpula silo
    g.beginFill(0x8f989e); g.drawRect(9, -1, 8, 1); g.drawRect(9, 5, 8, 1); g.endFill() // aros
    g.beginFill(0xb43a2f); g.drawRect(-15, -2, 20, 18); g.endFill() // granero
    g.beginFill(0x8f2a20); g.drawPolygon([-16, -2, -12, -11, 2, -11, 6, -2]); g.endFill() // tejado gambrel
    g.beginFill(0xe8e4d8); g.drawRect(-8, 4, 10, 12); g.endFill() // puerta
    g.beginFill(0xb43a2f); g.drawRect(-3.5, 4, 1, 12); g.drawRect(-8, 9, 10, 1); g.endFill() // cruces
  }

  /** Oficina: torre con rejilla de ventanas. @private */
  _drawOffice (g) {
    g.beginFill(0x5a6b7a); g.drawRect(-11, -18, 22, 34); g.endFill() // torre
    g.beginFill(0x46545f); g.drawRect(-11, -20, 22, 3); g.endFill() // azotea
    g.beginFill(0x9fd8ee)
    for (let ry = -14; ry <= 8; ry += 6) {
      for (let rx = -8; rx <= 4; rx += 6) g.drawRect(rx, ry, 4, 4)
    }
    g.endFill()
    g.beginFill(0x2f3a44); g.drawRect(-4, 10, 8, 6); g.endFill() // entrada
  }

  /** Tienda: cartel, toldo a rayas, escaparate y puerta. @private */
  _drawShop (g) {
    g.beginFill(0xd8c088); g.drawRect(-13, -2, 26, 18); g.endFill() // cuerpo
    g.beginFill(0x3a5a8a); g.drawRect(-11, -8, 22, 5); g.endFill() // cartel
    for (let i = 0; i < 8; i++) { // toldo a rayas
      g.beginFill(i % 2 ? 0xffffff : 0xd23b3b)
      g.drawRect(-13 + i * 3.25, -3, 3.25, 4)
      g.endFill()
    }
    g.beginFill(0x9fdcf0); g.drawRect(-11, 3, 13, 9); g.endFill() // escaparate
    g.beginFill(0x6b4626); g.drawRect(4, 4, 8, 12); g.endFill() // puerta
  }

  /**
   * Obtiene la posición actual de la cámara.
   */
  getCamera () {
    return { ...this.camera }
  }

  /**
   * Redimensiona el canvas al tamaño del contenedor.
   */
  resize () {
    const parent = this.app.view.parentElement
    if (parent) {
      this.app.renderer.resize(parent.clientWidth, parent.clientHeight)
      this.lighting.resize(this.app.screen.width, this.app.screen.height)
    }
  }

  /**
   * Destruye la escena y libera recursos.
   */
  destroy () {
    // Remover event listeners
    const view = this.app.view
    view.removeEventListener('mousedown', this._onMouseDown)
    globalThis.removeEventListener('mouseup', this._onMouseUp)
    globalThis.removeEventListener('mousemove', this._onMouseMove)
    view.removeEventListener('wheel', this._onWheel)
    view.removeEventListener('touchstart', this._onTouchStart)
    globalThis.removeEventListener('touchend', this._onTouchEnd)
    globalThis.removeEventListener('touchmove', this._onTouchMove)

    // Destruir contenedores
    this.npcSprites.forEach(sprite => sprite.destroy())
    this.npcLabels.forEach(label => label.destroy())
    this.buildingGraphics.forEach(graphic => graphic.destroy())
    this.npcSprites.clear()
    this.npcLabels.clear()
    this.buildingGraphics.clear()
    this.prevNPCStates.clear()

    // Destruir la aplicación Pixi
    this.app.destroy(true, { children: true, texture: true })
  }
}
