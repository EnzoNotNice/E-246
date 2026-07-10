const { Message } = require("discord.js");

function applyEpicPlayer(player) {
  player.twentyFourSeven = false;

  player.setResumeMessage = function (client, message) {
    if (this.pausedMessage && !client.isMessageDeleted?.(this.pausedMessage)) {
      this.pausedMessage.delete().catch(() => {});
      client.markMessageAsDeleted?.(this.pausedMessage);
    }
    return (this.resumeMessage = message);
  };

  player.setPausedMessage = function (client, message) {
    if (this.resumeMessage && !client.isMessageDeleted?.(this.resumeMessage)) {
      this.resumeMessage.delete().catch(() => {});
      client.markMessageAsDeleted?.(this.resumeMessage);
    }
    return (this.pausedMessage = message);
  };

  player.setNowplayingMessage = function (client, message) {
    if (this.nowPlayingMessage && !client.isMessageDeleted?.(this.nowPlayingMessage)) {
      this.nowPlayingMessage.delete().catch(() => {});
      client.markMessageAsDeleted?.(this.nowPlayingMessage);
    }
    return (this.nowPlayingMessage = message);
  };

  return player;
}

module.exports = { applyEpicPlayer };
