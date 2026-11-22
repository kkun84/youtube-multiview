// YouTube IFrame Player API の代わり。テストでは本物の動画を読み込まない
;(() => {
  const players = new Map()
  const State = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
  const started = performance.now()
  class Player {
    constructor(id, options) {
      const frame = document.createElement("iframe")
      frame.id = id
      frame.srcdoc = "<body style='margin:0;background:#234'></body>"
      document.querySelector(`#${CSS.escape(id)}`).replaceWith(frame)
      this.frame = frame
      this.options = options
      this.videoId = options.videoId
      this.state = State.UNSTARTED
      this.muted = false
      this.behind = 0
      this.calls = []
      players.set(id, this)
      setTimeout(() => options.events.onReady({ target: this }), 0)
    }
    change(state) {
      this.state = state
      this.options.events.onStateChange({ target: this, data: state })
    }
    playVideo() {
      this.calls.push("playVideo")
      if (this.state !== State.PLAYING) this.change(State.PLAYING)
    }
    pauseVideo() {
      this.calls.push("pauseVideo")
      if (this.state !== State.PAUSED) this.change(State.PAUSED)
    }
    mute() {
      this.muted = true
    }
    unMute() {
      this.muted = false
    }
    isMuted() {
      return this.muted
    }
    setVolume() {}
    getPlayerState() {
      return this.state
    }
    getDuration() {
      return 3600 + (performance.now() - started) / 1000
    }
    getCurrentTime() {
      return this.getDuration() - this.behind
    }
    seekTo(seconds) {
      this.calls.push("seekTo")
      this.behind = Math.max(0, this.getDuration() - seconds)
    }
    getPlaybackRate() {
      return 1
    }
    getVideoData() {
      return { isLive: true, title: `配信 ${this.videoId}` }
    }
    getIframe() {
      return this.frame
    }
    destroy() {
      players.delete(this.frame.id)
      this.frame.remove()
    }
  }
  window.YT = { Player, PlayerState: State, get: (id) => players.get(id) }
  window.fakeYouTube = { players, byVideo: (videoId) => [...players.values()].find((p) => p.videoId === videoId) }
  window.onYouTubeIframeAPIReady?.()
})()
