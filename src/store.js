// A JSON file is enough for the demo; every read/write goes through here so a real database can replace it.
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const FILE = process.env.TECHPULSE_DB || new URL('../data/db.json', import.meta.url).pathname
const EMPTY = { users: {}, items: {}, events: {}, userEvents: {}, deliveries: [], sourceStatus: {}, seen: {} }

let db = null

export function load() {
  if (db) return db
  db = existsSync(FILE) ? { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(FILE, 'utf8')) } : structuredClone(EMPTY)
  return db
}

export function save() {
  mkdirSync(dirname(FILE), { recursive: true })
  writeFileSync(FILE + '.tmp', JSON.stringify(db, null, 1))
  renameSync(FILE + '.tmp', FILE)
}

export function getUser(id) {
  return load().users[id]
}

export function putUser(user) {
  load().users[user.id] = user
  save()
  return user
}

export function userEvents(userId) {
  const all = load().userEvents
  return (all[userId] ??= {})
}
