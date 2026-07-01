/**
 * utils/index.ts — 通用工具函数
 *
 * 纯函数，无状态，不依赖 React。
 * 主要用于剪贴板操作和文件下载。
 */

/**
 * 将文本写入系统剪贴板。
 * @returns 成功返回 true，失败返回 false（如权限被拒绝）
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
}

/**
 * 触发浏览器下载文本文件。
 * 通过创建临时 <a> 标签 + Blob URL 实现，无需服务端参与。
 * @param filename - 下载文件名（如 "润色结果.txt"）
 * @param text - 文件内容
 */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)  // 释放 Blob URL，避免内存泄漏
}
