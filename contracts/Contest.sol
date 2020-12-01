pragma solidity 0.5.16;

contract Contest{
	struct Contestant{
		uint id;
		string name;
		uint voteCount;
	}

	mapping(uint => Contestant) public contestants;

	uint public contestantsCount;

	constructor()public{
		addContestant("tom");
		addContestant("jerry");
	}

	function addContestant (string memory _name) private{
		contestantsCount ++;
		contestants[contestantsCount] = Contestant(contestantsCount,_name,0);
	}
}