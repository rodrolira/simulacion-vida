// src/pixi/SpriteManager.js
import * as PIXI from 'pixi.js'

export class SpriteManager {
  constructor () {
    this.animations = {}
    this.generateTextures()
  }

  generateTextures () {
    const size = 16
    const colors = {
      skin: ['#f4c896', '#e8b07d', '#d4a06a', '#c49464'],
      hair: ['#4a3728', '#8b6914', '#2c1a0e', '#cc8833', '#dddddd'],
      shirt: ['#5577cc', '#55aa55', '#cc5555', '#ccaa55', '#aa55cc'],
      pants: ['#334455', '#445566', '#223344', '#554433']
    }

    // Generar 4 variantes de NPC (para diversidad)
    for (let variant = 0; variant < 4; variant++) {
      const sheet = this.generateSpritesheet(size, colors, variant)
      this.animations[variant] = this.parseSpritesheet(sheet, size)
    }
  }

  generateSpritesheet (size, colors, variant) {
    const cols = 8 // 4 direcciones × 2 animaciones (idle, walk)
    const rows = 4 // 4 frames por animación
    const canvas = document.createElement('canvas')
    canvas.width = size * cols
    canvas.height = size * rows
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false

    const skin = colors.skin[variant % colors.skin.length]
    const hair = colors.hair[variant % colors.hair.length]
    const shirt = colors.shirt[variant % colors.shirt.length]
    const pants = colors.pants[variant % colors.pants.length]

    for (let dir = 0; dir < 4; dir++) {
      for (let anim = 0; anim < 2; anim++) {
        for (let frame = 0; frame < 4; frame++) {
          const ox = (dir * 2 + anim) * size
          const oy = frame * size
          this.drawFrame(ctx, ox, oy, size, dir, anim, frame, {
            skin,
            hair,
            shirt,
            pants
          })
        }
      }
    }

    return PIXI.Texture.from(canvas)
  }

  drawFrame (ctx, ox, oy, size, dir, anim, frame, colors) {
    // Animación idle: respiración sutil (cabeza sube/baja 1px)
    const idleBob = anim === 0 ? Math.sin((frame * Math.PI) / 2) * 0.5 : 0
    // Animación walk: cuerpo sube/baja, piernas se mueven
    const walkBob =
      anim === 1 ? Math.abs(Math.sin((frame * Math.PI) / 2)) * 2 : 0

    const bob = anim === 0 ? idleBob : walkBob

    // Cabeza
    ctx.fillStyle = colors.skin
    ctx.fillRect(ox + 5, oy + bob, 6, 5)
    ctx.fillStyle = colors.hair
    ctx.fillRect(ox + 4, oy + bob - 2, 8, 4)

    // Ojos (según dirección)
    ctx.fillStyle = '#000'
    if (dir === 0) {
      // abajo
      ctx.fillRect(ox + 6, oy + 2 + bob, 1, 1)
      ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1)
    } else if (dir === 1) {
      // arriba
      ctx.fillRect(ox + 6, oy + 1 + bob, 1, 1)
      ctx.fillRect(ox + 10, oy + 1 + bob, 1, 1)
    } else if (dir === 2) {
      // izquierda
      ctx.fillRect(ox + 5, oy + 2 + bob, 1, 1)
    } else {
      // derecha
      ctx.fillRect(ox + 11, oy + 2 + bob, 1, 1)
    }

    // Cuerpo
    ctx.fillStyle = colors.shirt
    ctx.fillRect(ox + 4, oy + 5 + bob, 8, 6)

    // Brazos (animación walk: se balancean)
    const armSwing = anim === 1 ? Math.sin((frame * Math.PI) / 2) * 2 : 0
    ctx.fillStyle = colors.skin
    ctx.fillRect(ox + 2, oy + 6 + bob + armSwing * 0.5, 2, 4)
    ctx.fillRect(ox + 12, oy + 6 + bob - armSwing * 0.5, 2, 4)

    // Piernas
    ctx.fillStyle = colors.pants
    const legOffset = anim === 1 ? Math.sin((frame * Math.PI) / 2) * 2 : 0
    ctx.fillRect(ox + 5, oy + 11 + bob, 3, 5 - legOffset * 0.5)
    ctx.fillRect(ox + 9, oy + 11 + bob, 3, 5 + legOffset * 0.5)

    // Zapatos
    ctx.fillStyle = '#333'
    ctx.fillRect(ox + 4, oy + 14 + bob, 4, 2)
    ctx.fillRect(ox + 8, oy + 14 + bob, 4, 2)
  }

  parseSpritesheet (texture, size) {
    const animations = {}
    const dirs = ['down', 'up', 'left', 'right']
    const types = ['idle', 'walk']

    dirs.forEach((dir, d) => {
      types.forEach((type, t) => {
        const key = `${type}_${dir}`
        animations[key] = []
        for (let f = 0; f < 4; f++) {
          const rect = new PIXI.Rectangle(
            (d * 2 + t) * size,
            f * size,
            size,
            size
          )
          animations[key].push(new PIXI.Texture(texture.baseTexture, rect))
        }
      })
    })

    return animations
  }

  createNPCSprite (variant = 0) {
    const sprite = new PIXI.AnimatedSprite(
      this.animations[variant]['idle_down']
    )
    sprite.anchor.set(0.5, 0.8)
    sprite.scale.set(2.5)
    sprite.animationSpeed = 0.1
    sprite.play()
    sprite.variant = variant
    sprite.currentAnim = 'idle_down'
    return sprite
  }

  setAnimation (sprite, anim, direction) {
    const key = `${anim}_${direction}`
    if (sprite.currentAnim === key) return
    sprite.currentAnim = key
    sprite.textures = this.animations[sprite.variant][key]
    sprite.play()
  }
}
