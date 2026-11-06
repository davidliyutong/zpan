import { env } from 'cloudflare:workers'
import { and, eq, isNotNull } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { DirType, ObjectStatus } from '../../../shared/constants'
import { generateId } from '../../../shared/ids'
import { matters } from '../../db/schema'
import { createCloudflarePlatform } from '../../platform/cloudflare'
import { createMatterRepo } from './matter'

// D1 rejects any statement binding more than 100 parameters. Folders synced by
// WebDAV apps (OmniFocus, Zotero, ...) easily hold hundreds of files, so every
// bulk operation over a folder's descendants must stay under that limit.
const MANY = 150

function buildDb() {
  return createCloudflarePlatform(env).db
}

async function seedFolderWithFiles(count: number) {
  const db = buildDb()
  const orgId = `org-${generateId(8)}`
  const now = new Date()
  const base = {
    orgId,
    size: 0,
    storageId: 'storage-1',
    status: ObjectStatus.ACTIVE,
    trashedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  const folder = {
    ...base,
    id: generateId(),
    alias: generateId(10),
    name: 'Big.ofocus',
    type: 'folder',
    dirtype: DirType.USER_FOLDER,
    parent: '',
    object: '',
  }
  const files = Array.from({ length: count }, (_, index) => ({
    ...base,
    id: generateId(),
    alias: generateId(10),
    name: `file-${index}.zip`,
    type: 'application/zip',
    size: 10,
    dirtype: DirType.FILE,
    parent: folder.name,
    object: `objects/${generateId()}`,
  }))
  await db.insert(matters).values(folder)
  // Seed in small batches so the fixture itself respects the D1 parameter limit.
  for (let index = 0; index < files.length; index += 5) {
    await db.insert(matters).values(files.slice(index, index + 5))
  }
  return { db, orgId, folder, files }
}

async function countWhere(db: ReturnType<typeof buildDb>, orgId: string, column: 'trashedAt' | 'purgedAt') {
  const rows = await db
    .select({ id: matters.id })
    .from(matters)
    .where(and(eq(matters.orgId, orgId), isNotNull(matters[column])))
  return rows.length
}

describe('matter repo bulk operations on D1 (more than 100 ids)', () => {
  it('trashes and restores a folder with many descendants', async () => {
    const { db, orgId, folder } = await seedFolderWithFiles(MANY)
    const repo = createMatterRepo(db)

    await expect(repo.trash(orgId, folder.id)).resolves.toMatchObject({ id: folder.id })
    expect(await countWhere(db, orgId, 'trashedAt')).toBe(MANY + 1)

    await expect(repo.restore(orgId, folder.id)).resolves.toMatchObject({ id: folder.id })
    expect(await countWhere(db, orgId, 'trashedAt')).toBe(0)
  })

  it('purges a trashed folder with many descendants', async () => {
    const { db, orgId, folder } = await seedFolderWithFiles(MANY)
    const repo = createMatterRepo(db)
    await repo.trash(orgId, folder.id)

    const collected = await repo.collectForPurge(orgId, folder.id)
    expect(collected).toHaveLength(MANY + 1)
    await repo.purge(
      orgId,
      (collected ?? []).map((matter) => matter.id),
    )
    expect(await countWhere(db, orgId, 'purgedAt')).toBe(MANY + 1)
  })

  it('reads, trashes and restores many ids at once', async () => {
    const { db, orgId, files } = await seedFolderWithFiles(MANY)
    const repo = createMatterRepo(db)
    const ids = files.map((file) => file.id)

    expect(await repo.getMany(orgId, ids)).toHaveLength(MANY)

    await repo.trashByIds(orgId, ids)
    expect(await countWhere(db, orgId, 'trashedAt')).toBe(MANY)

    await repo.restoreActiveByIds(orgId, ids)
    expect(await countWhere(db, orgId, 'trashedAt')).toBe(0)
  })
})
