var Contest = artifacts.require("./Contest.sol")

contract("Contest",function(accounts){
    it("initialize with two contestants",function(){
        return Contest.deployed().then(function(instance){
            return instance.contestantsCount();
        }).then(function(count){
            assert.equal(count,2);
        })
        
    })
})