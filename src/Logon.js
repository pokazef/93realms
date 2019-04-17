'use strict';

const { playerDb } = require('./Databases');
const ConnectionHandler = require('./ConnectionHandler');
const { PlayerRank } = require('./Attributes');
const Player = require('./Player');
const Game = require('./Game');

// Acceptable states
const NEWCONNECTION = "NEWCONNECTION";
const NEWUSER = "NEWUSER";
const ENTERNEWPASS = "ENTERNEWPASS";
const ENTERPASS = "ENTERPASS";

const MAX_NUM_ERRORS = 5; // max invalid password entries before disconnect

// Logon Handler class
class Logon extends ConnectionHandler {

  constructor(connection) {
    super(connection);
    this.state = NEWCONNECTION;
    this.numErrors = 0;// how many times an invalid answer has been entered
    this.name = null;
    this.password = null;
  }

  enter() {
    var a = [];
    for (let key of playerDb.map.keys()) {
      const player = playerDb.map.get(key);
      if (player.loggedIn){
        a.push(player.name);
      }
    }

    var loginScreen = "[0;30m.................................................[s[s[0;37m@@@@@@ [0;30m........................................[s[s[0;37m@@@@@@@@@@@@@@@@@@@@@@@@ [0;30m.[s[s[0;37m@[0;30m..................................[s[s[0;37m@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@[0;30m....[s[s[0;37m@@[0;30m.......................[s[s[0;37m@@@@[0;30m.[s[s[0;37m@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ [0;30m.....[s[s[0;37m@@@[0;30m....[s[s[0;37m@@[0;30m...[s[s[0;37m@@@@[0;30m...[s[s[0;37m@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@@@[0;32m####################[s[0;37m@@@@@@@ [0;30m..........[s[s[0;37m@@@@[0;30m..[s[s[0;37m@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@[0;32m#########################[s[0;37m@@@@@@@ [0;36m$$[s[0;30m........[s[s[0;37m@[0;30m.....[s[s[0;37m@@@[0;30m...[s[s[0;37m@@@@@[0;30m..[s[s[0;37m@@[0;30m..[s[s[0;37m@@[0;30m.[s[0;32m##########################[s[0;37m@@@@@@@ [0;30m.....[s[0;36m$$$[s[0;30m...........[s[0;36m$$[s[0;30m.[s[s[0;37m@[0;30m...[s[0;36m$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m##########################[s[0;37m@@@@@@@ [0;30m.....[s[0;36m$[s[0;30m....[s[0;36m$$$$[s[0;30m..[s[0;36m$$$$$[s[0;30m.[s[0;36m$$$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m########[s[0;37m@@[0;32m######[s[0;37m@@[0;32m########[s[0;37m@@@@@@@ [0;30m..........[s[0;36m$$$$[s[0;30m..[s[0;36m$$$$$[s[0;30m.[s[0;36m$$$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m#######[s[0;37m@@@@[0;32m####[s[0;37m@@@@[0;32m#######[s[0;37m@@@@@@@ [0;36m$$[s[0;30m........[s[0;36m$[s[0;30m.....[s[0;36m$$$[s[0;30m...[s[0;36m$$$$$[s[0;30m..[s[s[0;37m@@[0;30m..[s[s[0;37m@@[0;30m.[s[0;32m#######[s[0;37m@@@@[0;32m####[s[0;37m@@@@[0;32m#######[s[0;37m@@@@@@@ [0;30m.....[s[0;36m$$$[s[0;30m...........[s[0;36m$$[s[0;30m.[s[0;36m$[s[0;30m...[s[0;36m$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m#######[s[0;37m@@@@[0;32m####[s[0;37m@@@@[0;32m#######[s[0;37m@@@@@@@ [0;30m.....[s[0;36m$[s[0;30m....[s[0;36m$$$$[s[0;30m..[s[0;36m$$$$$[s[0;30m.[s[0;36m$$$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m########[s[0;37m@@[0;32m######[s[0;37m@@[0;32m########[s[0;37m@@@@@@@ [0;30m.[s[s[0;37m@[0;30m........[s[0;36m$$$[s[0;30m...[s[0;36m$$$$$[s[0;30m.[s[0;36m$$$$$$[s[0;30m.[s[s[0;37m@@@@[0;30m...[s[0;32m##########################[s[0;37m@@@@@@@ @@[0;30m....[s[s[0;37m@@[0;30m........[s[0;36m$[s[0;30m.....[s[0;36m$$$[s[0;30m......[s[s[0;37m@@@@[0;30m.[s[0;32m##[s[0;37m@[0;32m####################[s[0;37m@[0;32m##[s[0;37m@@@@@@@ [0;30m.....[s[s[0;37m@@@[0;30m....[s[s[0;37m@@[0;30m...[s[s[0;37m@@@@[0;30m...[s[s[0;37m@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m###[s[0;37m@[0;32m##################[s[0;37m@[0;32m###[s[0;37m@@@@@@@ [0;30m..........[s[s[0;37m@@@@[0;30m..[s[s[0;37m@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m####[s[0;37m@@[0;32m##############[s[0;37m@@[0;32m####[s[0;37m@@@@@@@ [0;35m$$[s[0;30m........[s[s[0;37m@[0;30m.....[s[s[0;37m@@@[0;30m...[s[s[0;37m@@@@@[0;30m..[s[s[0;37m@@[0;30m..[s[s[0;37m@@[0;30m.[s[0;32m######[s[0;37m@@[0;32m##########[s[0;37m@@[0;32m######[s[0;37m@@@@@@@ [0;30m.....[s[0;35m$$$[s[0;30m...........[s[0;35m$$[s[0;30m.[s[s[0;37m@[0;30m...[s[0;35m$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m#########[s[0;37m@@@@@@@@[0;32m#########[s[0;37m@@@@@@@ [0;30m.....[s[0;35m$[s[0;30m....[s[0;35m$$$$[s[0;30m..[s[0;35m$$$$$[s[0;30m.[s[0;35m$$$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m##########################[s[0;37m@@@@@@@ [0;30m.[s[0;35m$[s[0;30m........[s[0;35m$$$[s[0;30m...[s[0;35m$$$$$[s[0;30m.[s[0;35m$$$$$$[s[0;30m.[s[s[0;37m@@@@[0;30m...[s[0;32m##########################[s[0;37m@@@@@@@ [0;35m$$[s[0;30m....[s[0;35m$$[s[0;30m........[s[0;35m$[s[0;30m.....[s[0;35m$$$[s[0;30m......[s[s[0;37m@@@@[0;30m.[s[0;32m##########################[s[0;37m@@@@@@@ [0;30m.....[s[0;35m$$$[s[0;30m....[s[0;35m$$[s[0;30m...[s[0;35m$$$$[s[0;30m...[s[0;35m$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m######[s[0;37m@@@@@@@@@@@@@@@@@@@[0;32m#[s[0;37m@@@@@@@ [0;30m..........[s[0;35m$$$$[s[0;30m..[s[0;35m$$$$$[s[0;30m.[s[0;35m$$$$$$[s[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[0;32m#[s[0;37m@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@[0;30m........[s[0;35m$[s[0;30m.....[s[0;35m$$$[s[0;30m...[s[0;35m$$$$$[s[0;30m..[s[s[0;37m@@[0;30m..[s[s[0;37m@@[0;30m.[s[s[0;37m@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ [0;30m.....[s[s[0;37m@@@[0;30m...........[s[s[0;37m@@[0;30m.[s[0;35m$[s[0;30m...[s[s[0;37m@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@@@@@@[0;30m..............[s[s[0;37m@@@@@@@@@@ [0;30m.....[s[s[0;37m@[0;30m....[s[s[0;37m@@@@[0;30m..[s[s[0;37m@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@[0;30m...........................[s[s[0;37m@@@@ [0;30m..........[s[s[0;37m@@@[0;30m...[s[s[0;37m@@@@@[0;30m.[s[s[0;37m@@@@@@[0;30m.[s[s[0;37m@@@@ [0;30m................[s[s[0;37m@[0;30m.....[s[s[0;37m@@@   ‎";
    //var loginScreen = ":3";
    const welcomeMsg = "<bold><red>Welcome to 93 Realms.</red></bold>\r\n" + loginScreen + '\r\n\r\n' +
                       `<cyan>${(a.length >= 1 ? `There ${a.length == 1 ? 'is' : 'are'} currently ${a.length} ${a.length == 1 ? 'player' : 'players'} online.\r\n<bold><cyan>${a.join(', ')}</cyan></bold>` : "There are no players online.")}</cyan>\r\n` +
                       "<white>Please enter your name, or \"new\" if you are new. </white>\r\n";
    this.connection.sendMessage(welcomeMsg);
  }

  handle(data) {
    if (this.numErrors === MAX_NUM_ERRORS) {
      this._handleMaxErrors();
      return;
    }

    if (this.state === NEWCONNECTION) {
      if (data.toLowerCase() === 'new') {
        this.state = NEWUSER;
        const msg = "<yellow>Please enter your desired name. </yellow>\r\n"
        this.connection.sendMessage(msg);
      } else { // existing user
        const player = playerDb.findByNameFull(data);
        let msg;
        if (!player) {
          this.numErrors++;
          msg = "<red><bold>Sorry, the user '<white>" +
                data + "</white>' does not exist\r\n" +
                "Please enter your name, or " +
                "\"new\" if you are new. </bold></red>\r\n";
        } else {
          this.state = ENTERPASS;
          this.name = data;
          this.password = player.password;
          msg = "<green><bold>Welcome, " +
                "<white>" + data + "</white>\r\n" +
                "Please enter your password. </bold></green>\r\n";
        }
        this.connection.sendMessage(msg);
      }
      return;
    }

    if (this.state === NEWUSER) {
      let msg;
      // check if the name is taken

      // sanitize //
      data = data.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
      data.trim();
      //////////////

      if (playerDb.hasNameFull(data)) {
        this.numErrors++;
        msg = "<red><bold>Sorry, the name '<white>" + data +
              "</white>' has already been taken.\r\n" +
              "<yellow>Please enter your desired name. " +
              "</yellow></bold></red>\r\n";
      } else {
        if (!this.acceptableName(data)) {
          this.numErrors++;
          msg = "<red><bold>Sorry, the name '<white>" + data +
                "</white>' is unacceptible.\r\n" +
                "<yellow>Please enter your desired name. " +
                "</yellow></bold></red>\r\n";
        } else {
          this.state = ENTERNEWPASS;
          this.name = data;
          msg = "<green>Please enter your desired password. </green>\r\n";
        }
      }
      this.connection.sendMessage(msg);
      return;
    }

    if (this.state === ENTERNEWPASS) {
      let msg;
      if (!data || data.indexOf(' ') !== -1) {
        this.numErrors++;
        msg = "<bold><red>INVALID PASSWORD!</red>\r\n" +
              "<green>Please enter your desired password. " +
              "</green></bold>\r\n";
        this.connection.sendMessage(msg);
        return;
      }
       // happy hour
      var happyStr = "<yellow>It's not happy hour.</yellow>";
      var hour = new Date().getHours(); 
      if (hour>17&&hour<20) { 
        happyStr="\r\n<yellow>It's happy hour!</yellow>";
       };
      msg = "<green>Thank you! " +
            "You are now entering the realm..."+happyStr+"</green>\r\n";

      this.connection.sendMessage(msg);

      const player = new Player();
      player.name = this.name;
      player.password = data;

      // make the player the administrator if he's the first to log in.
      if (playerDb.size() === 0) {
        player.rank = PlayerRank.ADMIN;
        player.id = 1;
      } else player.id = playerDb.lastId() + 1;

      // add the player
      playerDb.addPlayer(player);

      // enter the game as a newbie.
      this.goToGame(true);

      return;
    }

    if (this.state === ENTERPASS) {
      let msg;
      if (this.password === data) {


       // happy hour
      var happyStr = "";
      var hour = new Date().getHours(); 
      if (hour>17&&hour<20) { 
        happyStr="\r\n<yellow>It's happy hour!</yellow>";
       };

        msg = "<green>Thank you! " +
          "You are now entering the realm..."+happyStr+"</green>\r\n";
        this.connection.sendMessage(msg);
        this.goToGame(false);
      } else {
        msg = "<bold><red>INVALID PASSWORD!</red>\r\n" +
              "<green>Please enter your password. " +
              "</green></bold>\r\n";
        this.connection.sendMessage(msg);
      }
      return;
    }
  }

  goToGame(isNewbie) {
    const player = playerDb.findByNameFull(this.name);

    if (player.loggedIn) {
      this.connection.close();
      this.connection.clearHandlers();
    }

    player.newbie = isNewbie;

    // record the user's new connection
    player.connection = this.connection;

    // go to the game
    player.connection.removeHandler();
    player.connection.addHandler(
      new Game(player.connection, player));
  }

  acceptableName(name) {
    const invChars = /[\s"'~!@#\$%\^&\*\+\/\\\[\]{}<>\(\)\=\.,\?;\:]/;
    // must not contain any invalid characters
    if (name.match(invChars)) return false;

    // must be less than 17 chars and more than 2
    if (name.length > 16 || name.length <  3) return false;

    // must start with an alphabetical character
    if (!name[0].match(/[A-z]/)) return false;

    if (name === "new") return false;

    return true;
  }

  _handleMaxErrors() {
    this.connection.sendMessage("Too many incorrect reponses, closing connection...\r\n");
    this.connection.close();
  }

}

module.exports = Logon;
