import * as PIXI from 'pixi.js'

/**
 * Configuración de una partícula individual.
 * @constructor
 * @param {Object} options - Opciones de configuración
 * @param {number} options.x - Posición X inicial
 * @param {number} options.y - Posición Y inicial
 * @param {number} options.vx - Velocidad X
 * @param {number} options.vy - Velocidad Y
 * @param {number} options.life - Duración de vida en ticks
 * @param {number} options.color - Color en formato hex
 * @param {number} options.size - Tamaño en píxeles
 * @param {string} options.shape - Forma: 'heart', 'star', 'circle'
 */
function ParticleConfig ({ x, y, vx, vy, life, color, size, shape = 'circle' }) {
  this.x = x
  this.y = y
  this.vx = vx
  this.vy = vy
  this.life = life
  this.maxLife = life
  this.color = color
  this.size = size
  this.shape = shape
}

/**
 * Sistema de partículas para efectos visuales.
 * Emite corazones, estrellas y círculos cuando ocurren interacciones.
 */
export class ParticleSystem {
  /**
   * @param {PIXI.Container} parent - Contenedor donde se renderizan las partículas
   */
  constructor (parent) {
    if (!parent) {
      throw new Error('ParticleSystem requires a parent container')
    }
    this.parent = parent
    this.particles = []
    // Pool de gráficos reutilizables para mejor rendimiento
    this.graphicsPool = []
  }

  /**
   * Emite partículas de corazones (para interacciones sociales positivas).
   * @param {number} x - Posición X
   * @param {number} y - Posición Y
   * @param {number} [count=5] - Cantidad de partículas
   */
  emitHearts (x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
      const speed = 1 + Math.random() * 2
      this.particles.push(
        new ParticleConfig({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 40 + Math.random() * 20,
          color: 0xff6688,
          size: 3 + Math.random() * 3,
          shape: 'heart'
        })
      )
    }
  }

  /**
   * Emite partículas de comida.
   * @param {number} x - Posición X
   * @param {number} y - Posición Y
   * @param {number} [count=3] - Cantidad de partículas
   */
  emitFood (x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      this.particles.push(
        new ParticleConfig({
          x,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy: -1 - Math.random() * 2,
          life: 30,
          color: 0x88cc44,
          size: 2 + Math.random() * 2,
          shape: 'circle'
        })
      )
    }
  }

  /**
   * Emite partículas de trabajo.
   * @param {number} x - Posición X
   * @param {number} y - Posición Y
   * @param {number} [count=4] - Cantidad de partículas
   */
  emitWork (x, y, count = 4) {
    for (let i = 0; i < count; i++) {
      this.particles.push(
        new ParticleConfig({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -1 - Math.random() * 1.5,
          life: 25,
          color: 0xffcc44,
          size: 2 + Math.random() * 2,
          shape: 'star'
        })
      )
    }
  }

  /**
   * Emite partículas genéricas (para eventos personalizados).
   * @param {Object} options - Opciones de emisión
   * @param {number} options.x - Posición X
   * @param {number} options.y - Posición Y
   * @param {number} [options.count=5] - Cantidad
   * @param {number} [options.color=0xffffff] - Color
   * @param {string} [options.shape='circle'] - Forma
   * @param {number} [options.life=30] - Duración
   * @param {number} [options.speed=2] - Velocidad
   * @param {number} [options.spread=Math.PI] - Ángulo de dispersión
   */
  emit ({
    x,
    y,
    count = 5,
    color = 0xffffff,
    shape = 'circle',
    life = 30,
    speed = 2,
    spread = Math.PI
  }) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread
      this.particles.push(
        new ParticleConfig({
          x,
          y,
          vx: Math.cos(angle) * speed * Math.random(),
          vy: Math.sin(angle) * speed * Math.random(),
          life: life + Math.random() * 10,
          color,
          size: 2 + Math.random() * 3,
          shape
        })
      )
    }
  }

  /**
   * Actualiza y renderiza todas las partículas activas.
   * Debe llamarse en cada frame.
   */
  update () {
    // Limpiar el contenedor padre
    this.parent.removeChildren()

    // Actualizar y dibujar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life--

      // Eliminar partículas muertas
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      // Actualizar posición
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.02 // gravedad suave

      // Calcular opacidad
      const alpha = p.life / p.maxLife

      // Dibujar partícula
      const graphic = this._getGraphic()
      graphic.clear()
      graphic.alpha = alpha
      graphic.x = p.x
      graphic.y = p.y

      this._drawShape(graphic, p)
      this.parent.addChild(graphic)
    }
  }

  /**
   * Dibuja la forma correspondiente en un gráfico.
   * @private
   * @param {PIXI.Graphics} g - Objeto gráfico
   * @param {ParticleConfig} particle - Configuración de la partícula
   */
  _drawShape (g, particle) {
    g.beginFill(particle.color)

    switch (particle.shape) {
      case 'heart':
        // Dibujar corazón simplificado (dos círculos + triángulo)
        g.drawCircle(
          -particle.size * 0.3,
          -particle.size * 0.3,
          particle.size * 0.5
        )
        g.drawCircle(
          particle.size * 0.3,
          -particle.size * 0.3,
          particle.size * 0.5
        )
        g.drawPolygon([
          -particle.size * 0.7,
          -particle.size * 0.1,
          particle.size * 0.7,
          -particle.size * 0.1,
          0,
          particle.size * 0.7
        ])
        break

      case 'star': {
        // Estrella dibujada con polígono manual.
        // (PIXI.Graphics.drawStar NO existe en pixi.js v7 sin @pixi/graphics-extras,
        //  y usarlo lanzaba "drawStar is not a function", tumbando el render.)
        const spikes = 4
        const outer = particle.size
        const inner = particle.size * 0.4
        const pts = []
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outer : inner
          const a = (Math.PI / spikes) * i - Math.PI / 2
          pts.push(Math.cos(a) * r, Math.sin(a) * r)
        }
        g.drawPolygon(pts)
        break
      }

      case 'circle':
      default:
        // Dibujar círculo
        g.drawCircle(0, 0, particle.size)
        break
    }

    g.endFill()
  }

  /**
   * Obtiene o crea un gráfico del pool.
   * @private
   * @returns {PIXI.Graphics}
   */
  _getGraphic () {
    if (this.graphicsPool.length > 0) {
      return this.graphicsPool.pop()
    }
    return new PIXI.Graphics()
  }

  /**
   * Devuelve un gráfico al pool para reutilización.
   * @private
   * @param {PIXI.Graphics} graphic
   */
  _returnGraphic (graphic) {
    graphic.clear()
    graphic.alpha = 1
    graphic.x = 0
    graphic.y = 0
    if (this.graphicsPool.length < 50) {
      // Limitar tamaño del pool
      this.graphicsPool.push(graphic)
    } else {
      graphic.destroy()
    }
  }

  /**
   * Obtiene el número de partículas activas.
   * @returns {number}
   */
  get activeCount () {
    return this.particles.length
  }

  /**
   * Limpia todas las partículas.
   */
  clear () {
    this.particles.length = 0
    this.parent.removeChildren()
  }

  /**
   * Destruye el sistema y libera recursos.
   */
  destroy () {
    this.clear()
    this.graphicsPool.forEach(g => g.destroy())
    this.graphicsPool.length = 0
  }
}
