type QueueItem = {
  resolve: (token: string) => void
  reject: (error: unknown) => void
}

let isRefreshing = false

let failedQueue: QueueItem[] = []

export const refreshQueue = {
  isRefreshing: () => isRefreshing,

  startRefreshing() {
    isRefreshing = true
  },

  stopRefreshing() {
    isRefreshing = false
  },

  enqueue(item: QueueItem) {
    failedQueue.push(item)
  },

  process(error: unknown, token: string | null = null) {
    failedQueue.forEach((promise) => {
      if (error) {
        promise.reject(error)
        return
      }

      if (token) {
        promise.resolve(token)
      }
    })

    failedQueue = []
  },
}
