const { ether } = require("@openzeppelin/test-helpers");
const BEP20 = artifacts.require("BEP20");
const ServiceReceiver = artifacts.require("ServiceReceiver");
const BurnableBEP20 = artifacts.require("BurnableBEP20");

module.exports = async function (deployer, network, accounts) {
  const fee = ether("0.1");

  deployer.deploy(BEP20, "BurnSinarToDaGroundToken", "BSTDGT");
  await deployer.deploy(ServiceReceiver, {
    from: accounts[0],
  });

  const instance = await ServiceReceiver.deployed();
  instance.setPrice("BurnSinarToDaGroundToken", fee);

  await deployer.deploy(
    BurnableBEP20,
    "BurnSinarToDaGroundToken",
    "BSTDGT",
    18,
    100000000,
    instance.address,
    {
      from: accounts[0],
      value: fee,
    }
  );
};
