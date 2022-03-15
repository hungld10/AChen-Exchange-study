import { Contract, providers, utils, BigNumber } from "ethers";
import { 
    EXCHANGE_CONTRACT_ADDRESS,
    EXCHANGE_CONTRACT_ABI,
} from "../constants";

/**
 * removeLiquidity: Removes the `removeLPTokensWei` amount of LP tokens from
 * liquidity and also the calculated amount of `ether` and `CHEN` tokens
 */
export const removeLiquidity = async (signer, removeLPTokensWei) => {
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        signer
    );

    const tx = await exchangeContract.removeLiquidity(removeLPTokensWei);
    await tx.wait();
};

/**
 * getTokensAfterRemove: Calculates the amount of `Ether` and `CHEN` tokens
 * that would be returned back to user after he removes `removeLPTokenWei` amount
 * of LP tokens from the contract
 */
export const getTokensAfterRemove = async (
    provider,
    removeLPTokensWei,
    _ethBalance,
    chenTokenReserve
) => {
    try {
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            provider
        );

        // Get the total supply of `CHEN` LP tokens
        const _totalSupply = await exchangeContract.totalSupply();
        // Here we are using the Bignumber methods of multiplication and division
        // The amount of ether that would be sent back to the user after he withdraws the LP token
        // id calculated based on a ratio,
        // Ratio is -> (amount of ether that would be sent back to the user/ Eth reserves) = (LP tokens withdrawn)/(Total supply of LP tokens)
        // By some maths we get -> (amount of ether that would be sent back to the user) = (Eth Reserve * LP tokens withdrawn)/(Total supply of LP tokens)
        // Similariy we also maintain a ratio for the `CHEN` tokens, so here in our case
        // Ratio is -> (amount of CHEN tokens sent back to the user/ CHEN Token reserve) = (LP tokens withdrawn)/(Total supply of LP tokens)
        // Then (amount of CHEN tokens sent back to the user) = (CHEN token reserve * LP tokens withdrawn)/(Total supply of LP tokens)
        const _removeEther = _ethBalance.mul(removeLPTokensWei).div(_totalSupply);
        const _removeCHEN = chenTokenReserve.mul(removeLPTokensWei).div(_totalSupply);
        return {
            _removeEther,
            _removeCHEN
        };
    } catch (err) {
        console.error(err);
    }
}