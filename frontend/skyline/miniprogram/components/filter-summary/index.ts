Component({
  properties: {
    value: { type: String, value: '' },
  },
  methods: {
    handleAction() {
      this.triggerEvent('clear')
    },
  },
})
