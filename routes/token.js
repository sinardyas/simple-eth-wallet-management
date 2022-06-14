const Web3 = require("web3");
const Contract = require("web3-eth-contract");
const EthWalletHelper = require("ethereumjs-wallet").default;
const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");

const StandardBEP20 = require("../build/contracts/StandardBEP20.json");
const BurnableBEP20 = require("../build/contracts/BurnableBEP20.json");

const contracts = {
  SNRT: "0x710d0a49a7cc64ab42f39ad01b36aac305038466",
  BSTDGT: "0xdB96c4a5fe9aDf512f8C0EdcE5A985310AeEEa09",
};

const Web3Provider = new Web3(Web3.givenProvider || "http://127.0.0.1:7545");
Contract.setProvider(Web3.givenProvider || "http://127.0.0.1:7545");

const generateWalletJson = async (privateKey, password) => {
  const hexWallet = await EthWalletHelper.fromPrivateKey(
    Buffer.from(privateKey, "hex")
  );

  const walletJson = await hexWallet.toV3(password);
  return walletJson;
};

const createWallet = async (password) => {
  const { address, privateKey } = await Web3Provider.eth.accounts.create();

  const walletJson = generateWalletJson(privateKey.split("0x")[1], password);
  return { address, walletJson };
};

const createWalletSeedPhrase = async (password) => {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic, password).toString("hex");
  const hdwallet = hdkey.fromMasterSeed(seed);

  const walletHdPath = "m/44'/60'/0'/0";
  let wallet = await hdwallet.derivePath(walletHdPath).getWallet();
  const address = "0x" + wallet.getAddress().toString("hex");
  const privateKey = await wallet.getPrivateKey().toString("hex");

  const walletJson = await generateWalletJson(privateKey, password);
  return { address, walletJson };
};

const loadWalletWithPrivateKey = (privateKey) => {
  const account = Web3Provider.eth.accounts.privateKeyToAccount(privateKey);
  return account;
};

const checkBalance = async (address) => {
  const balance = await Web3Provider.eth.getBalance(address);
  const balanceInEther = Web3Provider.utils.fromWei(balance, "ether");
  return { balance, balanceInEther };
};

const checkTokenBalance = async (abi, contractAddress, walletAddress) => {
  const BEP20 = new Contract(abi, contractAddress);

  const symbol = await BEP20.methods.symbol().call();
  const balance = await BEP20.methods.balanceOf(walletAddress).call();

  return { symbol, balance };
};

function init(app) {
  const path = "/token";

  app.post(path + "/send-token", async (req, res) => {
    const { recipient, amount, privateKey } = req.body;
    const { address } = loadWalletWithPrivateKey(privateKey);

    if (address === recipient) {
      return res
        .status(400)
        .json({ status: "error", message: "Address cannot be same" });
    }

    const BEP20 = new Contract(BurnableBEP20.abi, contracts["BSTDGT"]);

    let result;
    try {
      result = await BEP20.methods
        .transfer(recipient, amount)
        .send({ from: address });
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      const errors = [];
      for (const [_, value] of Object.entries(error?.data)) {
        errors.push(value);
      }
      return res
        .status(400)
        .json({ status: "error", message: errors[0].reason });
    }

    return res.status(200).json({ status: "success /send-token", result });
  });

  app.post(path + "/burn-token", async (req, res) => {
    const { amount, privateKey } = req.body;
    const { address } = loadWalletWithPrivateKey(privateKey);

    const BEP20 = new Contract(BurnableBEP20.abi, contracts["BSTDGT"]);

    let result;
    try {
      result = await BEP20.methods.burn(amount).send({ from: address });
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      const errors = [];
      for (const [_, value] of Object.entries(error?.data)) {
        errors.push(value);
      }
      return res
        .status(400)
        .json({ status: "error", message: errors[0].reason });
    }

    return res.status(200).json({ status: "success /burn-token", result });
  });

  app.post(path + "/register", async (req, res) => {
    const { password } = req.body;
    const wallet = await createWallet(password);
    return res.status(200).json({ status: "success /register", wallet });
  });

  app.post(path + "/register-seed", async (req, res) => {
    const { password } = req.body;
    const wallet = await createWalletSeedPhrase(password);
    return res.status(200).json({ status: "success /register-seed", wallet });
  });

  app.post(path + "/get-balance", async (req, res) => {
    const { privateKey } = req.body;

    const account = loadWalletWithPrivateKey(privateKey);
    const { balanceInEther } = await checkBalance(account.address);

    const allBalance = await Promise.all([
      checkTokenBalance(
        BurnableBEP20.abi,
        contracts["BSTDGT"],
        account.address
      ),
      checkTokenBalance(StandardBEP20.abi, contracts["SNRT"], account.address),
    ]);

    const response = {};
    allBalance.forEach((element) => {
      response[element.symbol] = element.balance;
    });

    return res.status(200).json({
      status: "success /get-balance",
      balance: {
        ETH: balanceInEther,
        ...response,
      },
    });
  });
}

module.exports = init;
