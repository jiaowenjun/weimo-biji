Component({
  properties: {
    message: {
      type: String,
      value: '出了点问题',
    },
    retryText: {
      type: String,
      value: '重试',
    },
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry')
    },
  },
})
