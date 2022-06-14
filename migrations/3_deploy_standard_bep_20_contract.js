const { ether } = require("@openzeppelin/test-helpers");
const BEP20 = artifacts.require("BEP20");
const ServiceReceiver = artifacts.require("ServiceReceiver");
const StandardBEP20 = artifacts.require("StandardBEP20");

module.exports = async function (deployer, network, accounts) {
  const fee = ether("0.1");

  deployer.deploy(BEP20, "SinarToken", "SNRT");
  await deployer.deploy(ServiceReceiver, {
    from: accounts[0],
  });

  const instance = await ServiceReceiver.deployed();
  instance.setPrice("SinarToken", fee);

  await deployer.deploy(
    StandardBEP20,
    "SinarToken",
    "SNRT",
    8,
    100000000,
    instance.address,
    {
      from: accounts[0],
      value: fee,
    }
  );
};
