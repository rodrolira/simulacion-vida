import * as PIXI from 'pixi.js'

export class Tilemap {
  tileSize = 16
  constructor (parent, terrainData) {
    this.parent = parent

    // Generar texturas de tiles
    this.textures = this.generateTileTextures()

    if (terrainData) {
      this.loadFromData(terrainData)
    }
  }

  generateTileTextures () {
    const size = 16

    const tiles = [
      { name: 'grass', color: '#5a9c3f', detail: '#4a8c2f' },
      { name: 'grass_lush', color: '#3d8c2f', detail: '#2d7c1f' },
      { name: 'forest', color: '#3a7a2f', detail: '#2a5a1f' },
      { name: 'forest_dense', color: '#1a5a0f', detail: '#0a3a00' },
      { name: 'sand', color: '#d4c896', detail: '#c4b886' },
      { name: 'water', color: '#3366aa', detail: '#4477bb' },
      { name: 'mountain', color: '#888888', detail: '#777777' }
    ]

    // El ancho debe cubrir TODOS los tiles (antes era size*6 pero hay 7 -> el
    // último quedaba fuera del canvas y lanzaba "frame does not fit").
    const canvas = document.createElement('canvas')
    canvas.width = size * tiles.length
    canvas.height = size
    const ctx = canvas.getContext('2d')

    tiles.forEach((tile, i) => {
      const ox = i * size
      ctx.fillStyle = tile.color
      ctx.fillRect(ox, 0, size, size)
      // Detalles aleatorios
      ctx.fillStyle = tile.detail
      for (let j = 0; j < 4; j++) {
        ctx.fillRect(ox + Math.random() * 12, Math.random() * 12, 3, 3)
      }
    })

    // Crear una sub-textura POR tile. Si se compartiera una sola Texture y se le
    // cambiara el .frame por sprite, todos los tiles mostrarían el mismo frame.
    const base = PIXI.Texture.from(canvas).baseTexture
    this.tileNames = tiles.map(t => t.name)
    return tiles.map((_, i) =>
      new PIXI.Texture(base, new PIXI.Rectangle(i * size, 0, size, size))
    )
  }

  loadFromData (terrainData) {
    this.parent.removeChildren()
    this.width = terrainData.width
    this.height = terrainData.height

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tileType = terrainData.tiles[y]?.[x] || 'grass'
        const tileIndex = this.tileNames.indexOf(tileType)

        // Cada tipo de tile tiene su propia sub-textura (no se comparte el frame).
        const sprite = new PIXI.Sprite(this.textures[Math.max(0, tileIndex)])
        sprite.x = x * this.tileSize
        sprite.y = y * this.tileSize
        this.parent.addChild(sprite)
      }
    }
  }
}
