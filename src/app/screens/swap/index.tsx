import { useNavigate } from 'react-router-dom';
import TopRow from '@components/topRow';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import BottomBar from '@components/tabBar';
import SwapTokenBlock from '@screens/swap/swapTokenBlock';
import ArrowDown from '@assets/img/swap/arrow_swap.svg';
import { useSwap } from '@screens/swap/useSwap';
import { useCallback, useState } from 'react';
import { SwapInfoBlock } from '@screens/swap/swapInfoBlock';
import ActionButton from '@components/button';
import CoinSelectModal from '@screens/home/coinSelectModal';

const ScrollContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  row-gap: 16px;
  overflow-y: auto;
  &::-webkit-scrollbar {
    display: none;
  }
  margin-left: 5%;
  margin-right: 5%;
  padding-bottom: 16px;
`;

const Container = styled.div((props) => ({
  display: 'flex',
  flexDirection: 'column',
  rowGap: props.theme.spacing(8),
  marginTop: props.theme.spacing(16),
}));

const DownArrowButton = styled.button((props) => ({
  alignSelf: 'center',
  borderRadius: props.theme.radius(3),
  width: props.theme.spacing(18),
  height: props.theme.spacing(18),
  transition: 'all 0.2s ease',
  ':hover': {
    opacity: 0.8,
  },
}));

const SendButtonContainer = styled.div((props) => ({
  paddingBottom: props.theme.spacing(12),
  paddingTop: props.theme.spacing(4),
  marginLeft: '5%',
  marginRight: '5%',
}));

function SwapScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation('translation', { keyPrefix: 'SWAP_SCREEN' });
  const swap = useSwap();

  const [selecting, setSelecting] = useState<'from' | 'to'>();
  const [loading, setLoading] = useState(false);

  const handleClickContinue = useCallback(async () => {
    if (swap.submitError || !swap.onSwap) {
      return;
    }
    try {
      setLoading(true);
      await swap.onSwap();
    } finally {
      setLoading(false);
    }
  }, [swap, setLoading]);

  return (
    <>
      <TopRow title={t('SWAP')} onClick={() => navigate('/')} />
      <ScrollContainer>
        <Container>
          <SwapTokenBlock
            title={t('CONVERT')}
            selectedCoin={swap.selectedFromToken}
            amount={swap.inputAmount}
            error={swap.inputAmountInvalid}
            onAmountChange={swap.onInputAmountChanged}
            onSelectCoin={() => setSelecting('from')}
          />
          <DownArrowButton onClick={swap.handleClickDownArrow}>
            <img src={ArrowDown} alt="arrow-down" />
          </DownArrowButton>
          <SwapTokenBlock
            title={t('TO')}
            selectedCoin={swap.selectedToToken}
            onSelectCoin={() => setSelecting('to')}
          />
        </Container>
        <SwapInfoBlock swap={swap} />
      </ScrollContainer>
      {selecting != null && (
        <CoinSelectModal
          onSelectStacks={() => {
            swap.onSelectToken('STX', selecting);
          }}
          onClose={() => setSelecting(undefined)}
          onSelectCoin={(coin) => {
            swap.onSelectToken(coin, selecting);
          }}
          visible={!!selecting}
          coins={swap.coinsList}
          title={selecting === 'from' ? t('ASSET_TO_CONVERT_FROM') : t('ASSET_TO_CONVERT_TO')}
          loadingWalletData={swap.isLoadingWalletData}
        />
      )}
      <SendButtonContainer>
        <ActionButton
          disabled={!!swap.submitError || swap.onSwap == null}
          warning={!!swap.submitError}
          text={swap.submitError ?? t('CONTINUE')}
          processing={loading}
          onPress={handleClickContinue}
        />
      </SendButtonContainer>
      <BottomBar tab="dashboard" />
    </>
  );
}

export default SwapScreen;
