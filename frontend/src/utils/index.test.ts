/**
 * utils/index.test.ts — unit tests for utility functions
 */
import { copyToClipboard, downloadText } from './index'

// ── copyToClipboard ──

test('copyToClipboard resolves true on success', async () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  })

  const result = await copyToClipboard('hello')
  expect(result).toBe(true)
  expect(mockWriteText).toHaveBeenCalledWith('hello')
})

test('copyToClipboard resolves false on failure', async () => {
  const mockWriteText = vi.fn().mockRejectedValue(new Error('permission denied'))
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  })

  const result = await copyToClipboard('hello')
  expect(result).toBe(false)
})

test('downloadText creates link and triggers download', () => {
  const blobUrl = 'blob:http://localhost/test'
  const mockCreateObjectURL = vi.fn().mockReturnValue(blobUrl)
  const mockRevokeObjectURL = vi.fn()
  const mockClick = vi.fn()

  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  URL.createObjectURL = mockCreateObjectURL
  URL.revokeObjectURL = mockRevokeObjectURL

  const originalCreateElement = document.createElement.bind(document)
  const mockAnchor = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return mockAnchor
    return originalCreateElement(tag)
  })

  downloadText('test.txt', 'file content')

  expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
  const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob
  expect(blobArg).toBeInstanceOf(Blob)

  expect(mockAnchor.download).toBe('test.txt')
  expect(mockAnchor.href).toBe(blobUrl)
  expect(mockClick).toHaveBeenCalled()
  expect(mockRevokeObjectURL).toHaveBeenCalledWith(blobUrl)

  // Restore
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
  vi.restoreAllMocks()
})
