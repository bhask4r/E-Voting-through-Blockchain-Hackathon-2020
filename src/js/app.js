App = {
  web3Provider: null,
  contracts: {},
  account: 0x0,

  init: async function() {

    return await App.initWeb3();
  },

  initWeb3: async function() {
    if(typeof web3 !== 'undefined'){
      App.web3Provider = web3.currentProvider
      web3 = new Web3(web3.currentProvider)
    } else{
      App.web3Provider = Web3.providers.HttpProvider('http://127.0.0.1:7545')
      web3 = new Web3(App.web3Provider)
    }

    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Contest.json",function(contest){
      console.log(contest)
      console.log(TruffleContract(contest))
      App.contracts.Contest = TruffleContract(contest);
      App.contracts.Contest.setProvider(App.web3Provider)
    })

    return App.render();
  },

  render:function(){
    var contestInstance;
    var loader = $("loader");
    var content = $("content");

    loader.show();
    content.hide();

    web3.eth.getCoinbase(function(err,account){
      if(err === null){
        App.account = account;
        $("#accountAddress").html("Your Account: "+account);
      }
    })

    App.contracts.Contest().then(function(instance){
      contestInstance = instance
      return contestInstance.contestantsCount();
  }).then(function(contestantsCount){
      var contestantsResults=$("#contestantResults")
      contestantsResults.empty();
      for (let i = 0; i < contestantsCount; i++) {
        contestInstance.contestants(i).then(function(contestant){
          var id =contestant[0]
          var name =contestant[1]
          var voteCount = contestant[2]

          var contestantTemplate =`<tr><th>${id}</th><td>${name}</td><td>${voteCount}</td></tr>`
          contestantsResults.append(contestantTemplate)
        })
        
      }
      loader.hide();
      content.show();

  }).catch(error=>{
    console.warn(error)
  })
  }

};

$(function() {
  $(window).load(function() {
    App.init();
  });
});

const Web3 = require("web3");
const ethEnabled = () => {
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum);
    window.ethereum.enable();
    return true;
  }
  return false;
}
if (!ethEnabled()) {
  alert("Please install MetaMask to use this dApp!");
}