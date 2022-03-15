import { BigNumber, providers, utils } from "ethers"
import Head from 'next/head'
import React, { useEffect, useRef, useState } from "react"
import Web3Modal from "web3modal"
import styles from '../styles/Home.module.css'
import { addLiquidity, calculateCHEN } from "../utils/addLiquidity"
import { getTokensAfterRemove, removeLiquidity } from "../utils/removeLiquidity"
import {
  getCHENTokensBalance,
  getEtherBalance,
  getLPTokensBalance,
  getReserveOfCHENToken
} from "../utils/getAmounts"
import { swapTokens, getAmountOfTokensReceivedFromSwap } from "../utils/swap"

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [liquidityTab, setLiquidityTab] = useState(true);
  const zero = BigNumber.from(0);
  const [ethBalance, setEthBalance] = useState(zero);
  const [reservedCHEN, setReservedCHEN] = useState(zero);
  const [etherBalanceContract, setEtherBalanceContract] = useState(zero);
  const [chenBalance, setCHENBalance] = useState(zero);
  const [lpBalance, setLPBalance] = useState(zero);
  const [addEther, setAddEther] = useState(zero);
  const [addCHENTokens, setAddCHENTokens] = useState(zero);
  const [removeEther, setRemoveEther] = useState(zero);
  const [removeCHEN, setRemoveCHEN] = useState(zero);
  const [removeLPTokens, setRemoveLPTokens] = useState("0");
  const [swapAmount, setSwapAmount] = useState("");
  const [tokenToBeRecievedAfterSwap, setTokenToBeReceivedAfterSwap] = useState(zero);
  const [ethSelected, setEthSelected] = useState(true);
  const web3ModalRef = useRef();
  const [walletConnected, setWalletConnected] = useState(false);

  /**
   * Returns a Provider or Signer object representing the Ethereum RPC with or without the
   * signing capabilities of metamask attached
   *
   * A `Provider` is needed to interact with the blockchain - reading transactions, reading balances, reading state, etc.
   *
   * A `Signer` is a special type of Provider used in case a `write` transaction needs to be made to the blockchain, which involves the connected account
   * needing to make a digital signature to authorize the transaction being sent. Metamask exposes a Signer API to allow your website to
   * request signatures from the user using Signer functions.
   *
   * @param {*} needSigner - True if you need the signer, default false otherwise
   */
   const getProviderOrSigner = async (needSigner = false) => {
    // Connect to Metamask
    // Since we store `web3Modal` as a reference, we need to access the `current` value to get access to the underlying object
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    // If user is not connected to the Rinkeby network, let them know and throw an error
    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Change the network to Rinkeby");
      throw new Error("Change network to Rinkeby");
    }

    if (needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  };

  /**
   * getAmounts call various functions to retrive amounts for ethbalance,
   * LP tokens etc
   */
  const getAmounts = async () => {
    try {
      const provider = await getProviderOrSigner(false);
      const signer = await getProviderOrSigner(true);
      const address = await signer.getAddress();

      const _ethBalance = await getEtherBalance(provider, address);
      const _CHENBalance = await getCHENTokensBalance(provider, address);
      const _lpBalance = await getLPTokensBalance(provider, address);
      const _reservedCHEN = await getReserveOfCHENToken(provider);
      const _ethBalanceContract = await getEtherBalance(provider, null, true);

      setEthBalance(_ethBalance);
      setCHENBalance(_CHENBalance);
      setLPBalance(_lpBalance);
      setReservedCHEN(_reservedCHEN);
      setEtherBalanceContract(_ethBalanceContract);
    } catch (err) {
      console.error(err);
    }
  }

  /**** SWAP FUNCTIONS ****/

  /*
    swapTokens: Swaps  `swapAmountWei` of Eth/Chicken tokens with `tokenToBeRecievedAfterSwap` amount of Eth/Chicken tokens.
  */
  const _swapTokens = async () => {
    try {
      // Convert the amount entered by the user to a BigNumber using the `parseEther` library from `ethers.js`
      const swapAmountWei = utils.parseEther(swapAmount);
      // Check if the user entered zero
      // We are here using the `eq` method from BigNumber class in `ethers.js`
      if (!swapAmountWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        // Call the swapTokens function from the `utils` folder
        await swapTokens(
          signer,
          swapAmountWei,
          tokenToBeRecievedAfterSwap,
          ethSelected
        );
        setLoading(false);
        // Get all the updated amounts after the swap
        await getAmounts();
        setSwapAmount("");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setSwapAmount("");
    }
  }

  /*
    _getAmountOfTokensReceivedFromSwap:  Returns the number of Eth/Chicken tokens that can be recieved 
    when the user swaps `_swapAmountWEI` amount of Eth/Chicken tokens.
  */
  const _getAmountOfTokensReceivedFromSwap = async (_swapAmount) => {
    try {
      // Convert the amount entered by the user to a BigNumber using the `parseEther` library from `ethers.js`
      const _swapAmountWEI = utils.parseEther(_swapAmount.toString());
      // Check if the user entered zero
      // We are here using the `eq` method from BigNumber class in `ethers.js`
      if (!_swapAmountWEI.eq(zero)) {
        const provider = await getProviderOrSigner();
        // Get the amount of ether in the contract
        const _ethBalance = await getEtherBalance(provider, null, true);
        // Call the `getAmountOfTokensReceivedFromSwap` from the utils folder
        const amountOfTokens = await getAmountOfTokensReceivedFromSwap(
          _swapAmountWEI,
          provider,
          ethSelected,
          _ethBalance,
          reservedCHEN
        );
        setTokenToBeReceivedAfterSwap(amountOfTokens);
      } else {
        setTokenToBeReceivedAfterSwap(zero);
      }
    } catch (err) {
      console.error(err);
    }
  }

  /*** END ***/

  /**** ADD LIQUIDITY FUNCTIONS ****/

  /**
   * _addLiquidity helps add liquidity to the exchange,
   * If the user is adding initial liquidity, user decides the ether and CHEN tokens he wants to add
   * to the exchange. If we he adding the liquidity after the initial liquidity has already been added
   * then we calculate the chicken tokens he can add, given the eth he wants to add by keeping the ratios
   * constant
  */
  const _addLiquidity = async () => {
    try {
      // Convert the ether amount entered by the user to Bignumber
      const addEtherWei = utils.parseEther(addEther.toString());
      // Check if the values are zero
      if (!addCHENTokens.eq(zero) && !addEtherWei.eq(zero)) {
        const signer = await getProviderOrSigner(true);
        setLoading(true);
        // call the addLiquidity function from the utils folder
        await addLiquidity(
          signer,
          addCHENTokens,
          addEtherWei
        );
        setLoading(false);
        // Reinitialize the CHEN tokens
        await getAmounts();
      } else {
        setAddCHENTokens(zero);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      setAddCHENTokens(zero);
    }
  }

  /**** END ****/

  /**** REMOVE LIQUIDITY FUNCTIONS ****/

  /**
   * _removeLiquidity: Removes the `removeLPTokensWei` amount of LP tokens from
   * liquidity and also the calculated amount of `ether` and `CHEN` tokens
  */
  const _removeLiquidity = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      // Convert the LP tokens entered by the user to a BigNumber
      const removeLPTokensWei = utils.parseEther(removeLPTokens.toString());
      setLoading(true);
      // Call the removeLiquidity function from the `utils` folder
      await removeLiquidity(
        signer,
        removeLPTokensWei
      );
      setLoading(false);
      await getAmounts();
      setRemoveCHEN(zero);
      setRemoveEther(zero);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setRemoveCHEN(zero);
      setRemoveEther(zero);
    }
  }

  /**
   * _getTokensAfterRemove: Calculates the amount of `Ether` and `CD` tokens
   * that would be returned back to user after he removes `removeLPTokenWei` amount
   * of LP tokens from the contract
  */
  const _getTokensAfterRemove = async (_removeLPTokens) => {
    try {
      const provider = await getProviderOrSigner();
      // Convert the LP tokens entered by the user to a BigNumber
      const removeLPTokensWei = utils.parseEther(_removeLPTokens);
      // Get the Eth reserves within the exchange contract
      const _ethBalance = await getEtherBalance(provider, null, true);
      // get the chicken token reserves from the contract
      const chickenTokenReserve = await getReserveOfCHENToken(provider);
      // call the getTokensAfterRemove from the utils folder
      const { _removeEther, _removeCHEN } = await getTokensAfterRemove(
        provider,
        removeLPTokensWei,
        _ethBalance,
        chickenTokenReserve
      );
      setRemoveEther(_removeEther);
      setRemoveCHEN(_removeCHEN);
    } catch (err) {
      console.error(err);
    }
  }

  /**** END ****/

  /*
    connectWallet: Connects the MetaMask wallet
  */
  const connectWallet = async () => {
    try {
      // Get the provider from web3Modal, which in our case is MetaMask
      // When used for the first time, it prompts the user to connect their wallet
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (err) {
      console.error(err);
    }
  }

  // useEffects are used to react to changes in state of the website
  // The array at the end of function call represents what state changes will trigger this effect
  // In this case, whenever the value of `walletConnected` changes - this effect will be called
  useEffect(() => {
    // if wallet is not connected, create a new instance of Web3Modal and connect the MetaMask wallet
    if (!walletConnected) {
      // Assign the Web3Modal class to the reference object by setting it's `current` value
      // The `current` value is persisted throughout as long as this page is open
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });
      connectWallet();
      getAmounts();
    }
  }, [walletConnected]);

  /*
    renderButton: Returns a button based on the state of the dapp
  */
  const renderButton = () => {
    // If wallet is not connected, return a button which allows them to connect their wllet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    // If we are currently waiting for something, return a loading button
    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    if (liquidityTab) {
      return (
        <div>
          <div className={styles.description}>
            You have:
            <br />
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {utils.formatEther(chenBalance)} Chicken Tokens
            <br />
            {utils.formatEther(ethBalance)} Ether
            <br />
            {utils.formatEther(lpBalance)} Chicken LP tokens
          </div>
          <div>
            {/* If reserved CHEN is zero, render the state for liquidity zero where we ask the user
            who much initial liquidity he wants to add else just render the state where liquidity is not zero and
            we calculate based on the `Eth` amount specified by the user how much `CHEN` tokens can be added */}
            {utils.parseEther(reservedCHEN.toString()).eq(zero) ? (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={(e) => setAddEther(e.target.value || "0")}
                  className={styles.input}
                />
                <input
                  type="number"
                  placeholder="Amount of Chicken tokens"
                  onChange={(e) =>
                    setAddCHENTokens(
                      BigNumber.from(utils.parseEther(e.target.value || "0"))
                    )
                  }
                  className={styles.input}
                />
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={async (e) => {
                    setAddEther(e.target.value || "0");
                    // calculate the number of CHEN tokens that
                    // can be added given  `e.target.value` amount of Eth
                    const _addCHENTokens = await calculateCHEN(
                      e.target.value || "0",
                      etherBalanceContract,
                      reservedCHEN
                    );
                    setAddCHENTokens(_addCHENTokens);
                  }}
                  className={styles.input}
                />
                <div className={styles.inputDiv}>
                  {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                  {`You will need ${utils.formatEther(addCHENTokens)} Chicken
                  Tokens`}
                </div>
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            )}
            <div>
              <input
                type="number"
                placeholder="Amount of LP Tokens"
                onChange={async (e) => {
                  setRemoveLPTokens(e.target.value || "0");
                  // Calculate the amount of Ether and CHEN tokens that the user would recieve
                  // After he removes `e.target.value` amount of `LP` tokens
                  await _getTokensAfterRemove(e.target.value || "0");
                }}
                className={styles.input}
              />
              <div className={styles.inputDiv}>
                {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                {`You will get ${utils.formatEther(removeCHEN)} Chicken Tokens and ${utils.formatEther(removeEther)} Eth`}
              </div>
              <button className={styles.button1} onClick={_removeLiquidity}>
                Remove
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <input
            type="number"
            placeholder="Amount"
            onChange={async (e) => {
              setSwapAmount(e.target.value || "");
              // Calculate the amount of tokens user would recieve after the swap
              await _getAmountOfTokensReceivedFromSwap(e.target.value || "0");
            }}
            className={styles.input}
            value={swapAmount}
          />
          <select
            className={styles.select}
            name="dropdown"
            id="dropdown"
            onChange={async () => {
              setEthSelected(!ethSelected);
              // Initialize the values back to zero
              await _getAmountOfTokensReceivedFromSwap(0);
              setSwapAmount("");
            }}
          >
            <option value="eth">Ethereum</option>
            <option value="chickenToken">Chicken Token</option>
          </select>
          <br />
          <div className={styles.inputDiv}>
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {ethSelected
              ? `You will get ${utils.formatEther(
                  tokenToBeRecievedAfterSwap
                )} Chicken Tokens`
              : `You will get ${utils.formatEther(
                  tokenToBeRecievedAfterSwap
                )} Eth`}
          </div>
          <button className={styles.button1} onClick={_swapTokens}>
            Swap
          </button>
        </div>
      );
    }
  }

  return (
    <div>
      <Head>
        <title>Chicken Exchange</title>
        <meta name="description" content="Exchange-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Chicken Exchange!</h1>
          <div className={styles.description}>
            Exchange Ethereum &#60;&#62; Chicken Tokens
          </div>
          <div>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(!liquidityTab);
              }}
            >
              Liquidity
            </button>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(false);
              }}
            >
              Swap
            </button>
          </div>
          {renderButton()}
        </div>
        <div>
          <img className={styles.image} src="/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Hung Le
      </footer>
    </div>
  )
}
