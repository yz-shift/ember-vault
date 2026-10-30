/**
 * Gameplay units: pixels, seconds, HP. Every feel / growth knob lives here so
 * tuning never requires touching simulation code.
 *
 * Deliberately NOT `as const`: this table is read and compared everywhere, and
 * literal types turn ordinary numeric assignments into compile errors.
 */
export const TUNING = {
  player: {
    speed: 238,
    // Reaching full speed in ~0.07s and stopping in ~0.055s keeps the character
    // responsive without the digital on/off feel of instant velocity.
    accel: 3400,
    decel: 4300,
    radius: 10,
    // Hurt radius is deliberately smaller than the sprite so near misses read
    // as misses. Collision still uses `radius` so the body never clips walls.
    hurtRadius: 7.5,
    hp: 8,
    invincible: 0.85,
    knockback: 16,
    dashSpeed: 700,
    dashTime: 0.16,
    dashCooldown: 1.2,
  },
  tear: {
    damage: 9,
    rate: 5.6,
    speed: 615,
    range: 690,
    radius: 6,
    // Carrying a little of the player's momentum makes strafing feel connected
    // without bending shots far enough to miss what you aimed at.
    inheritVelocity: 0.18,
    inheritMax: 46,
    muzzle: 14,
    spreadAngle: 0.18,
    maxRate: 14,
    maxSpread: 3,
    maxPierce: 8,
    maxBounce: 4,
    // Visual only: bigger tears as damage grows.
    sizePerDamage: 0.18,
    maxSizeBonus: 3.4,
  },
  hit: {
    flash: 0.09,
    knockback: 15,
    bossKnockback: 2.5,
    stagger: 0.09,
    leechThreshold: 125,
  },
  enemies: {
    // Depth never inflates these. Growth has to come from the player's build,
    // or upgrades stop feeling like upgrades.
    hp: { swarm: 8, chaser: 17, shooter: 22, charger: 26, ring: 23, boss: 660 },
    speed: { swarm: 104, chaser: 88, shooter: 55, charger: 48, ring: 36, boss: 25 },
    separation: 65,
    personalSpace: 12,
    // Enemies materialise inert and untouchable for this long, with a marker on
    // the floor, so nothing ever appears on top of the player.
    spawnWarning: 0.62,
    spawnDistance: 168,
  },
  room: {
    transition: 0.23,
    firstWaveDelay: 0.15,
    betweenWaves: 0.36,
    pickupRadius: 29,
    magnet: 100,
    magnetSpeed: 440,
  },
  // Wave composition: crowds of fragile swarm enemies, a few specials to force
  // movement. Counts grow with depth; individual enemy HP does not.
  waves: {
    swarmBase: 4,
    swarmPerDepth: 0.9,
    swarmMax: 11,
    specialBase: 1,
    specialPerDepth: 0.34,
    specialMax: 4,
  },
  proc: {
    splitChildren: 3,
    maxSplitChildren: 5,
    fragmentGenerations: 1,
    fragmentsPerRoot: 6,
    fragmentDamage: 0.6,
    chainRange: 165,
    chainDamage: 0.66,
    chainJumps: 2,
    maxChainJumps: 6,
    blastsPerRoot: 3,
    blastDamage: 0.72,
    blastRadius: 68,
  },
  limits: {
    friendlyBullets: 260,
    enemyBullets: 180,
    spawnPerTick: 64,
    effects: 72,
    particles: 260,
    particlesPerDraw: 64,
  },
  feedback: {
    // Ordinary hits never shake. Only kills, explosions and taking damage do,
    // and even those are rate limited so a cleared crowd doesn't strobe.
    shakeInterval: 0.16,
    killShakeInterval: 0.26,
    hitSoundInterval: 0.035,
    killSoundInterval: 0.055,
  },
};
