import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import ConfirmScreen from '@components/confirmScreen';
import { decodeToken } from 'jsontokens';
import { useTranslation } from 'react-i18next';
import { createAuthResponse, handleLedgerStxJWTAuth } from '@secretkeylabs/xverse-core';
import { MESSAGE_SOURCE } from '@common/types/message-types';
import { useState } from 'react';
import useWalletSelector from '@hooks/useWalletSelector';
import DappPlaceholderIcon from '@assets/img/webInteractions/authPlaceholder.svg';
import validUrl from 'valid-url';
import AccountHeaderComponent from '@components/accountHeader';
import BottomModal from '@components/bottomModal';
import LedgerConnectDefault from '@assets/img/ledger/ledger_connect_default.svg';
import LedgerConnectionView from '@components/ledger/connectLedgerView';
import ActionButton from '@components/button';
import Transport from '@ledgerhq/hw-transport-webusb';
import { ledgerDelay } from '@common/utils/ledger';
import { AddressVersion, StacksMessageType, publicKeyToAddress } from '@stacks/transactions';
import { isHardwareAccount } from '@utils/helper';
import InfoContainer from '@components/infoContainer';

const MainContainer = styled.div({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
});

const SuccessActionsContainer = styled.div((props) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  paddingLeft: props.theme.spacing(8),
  paddingRight: props.theme.spacing(8),
  marginBottom: props.theme.spacing(20),
  marginTop: props.theme.spacing(20),
}));

const TopImage = styled.img({
  aspectRatio: 1,
  height: 88,
  borderWidth: 10,
  borderColor: 'white',
});

const FunctionTitle = styled.h1((props) => ({
  ...props.theme.headline_s,
  color: props.theme.colors.white['0'],
  marginTop: props.theme.spacing(8),
}));

const DappTitle = styled.h2((props) => ({
  ...props.theme.body_l,
  color: props.theme.colors.white['400'],
  marginTop: props.theme.spacing(2),
}));

const InfoContainerWrapper = styled.div((props) => ({
  margin: props.theme.spacing(10),
  marginBottom: 0,
}));

function AuthenticationRequest() {
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isConnectSuccess, setIsConnectSuccess] = useState(false);
  const [isConnectFailed, setIsConnectFailed] = useState(false);
  const [isTxApproved, setIsTxApproved] = useState(false);
  const [isTxRejected, setIsTxRejected] = useState(false);
  const { t } = useTranslation('translation', { keyPrefix: 'AUTH_REQUEST_SCREEN' });

  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const authRequestToken = params.get('authRequest') ?? '';
  const authRequest = decodeToken(authRequestToken);
  const { seedPhrase, selectedAccount } = useWalletSelector();

  const confirmCallback = async () => {
    setLoading(true);
    try {
      if (isHardwareAccount(selectedAccount)) {
        // setIsModalVisible(true);
        return;
      }

      const authResponse = await createAuthResponse(
        seedPhrase,
        selectedAccount?.id ?? 0,
        authRequest,
      );
      chrome.tabs.sendMessage(+(params.get('tabId') ?? '0'), {
        source: MESSAGE_SOURCE,
        payload: {
          authenticationRequest: authRequestToken,
          authenticationResponse: authResponse,
        },
        method: 'authenticationResponse',
      });
      window.close();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cancelCallback = () => {
    chrome.tabs.sendMessage(+(params.get('tabId') ?? '0'), {
      source: MESSAGE_SOURCE,
      payload: {
        authenticationRequest: authRequestToken,
        authenticationResponse: 'cancel',
      },
      method: 'authenticationResponse',
    });
    window.close();
  };

  const getDappLogo = () =>
    validUrl.isWebUri(authRequest?.payload?.appDetails?.icon)
      ? authRequest?.payload?.appDetails?.icon
      : DappPlaceholderIcon;

  const handleConnectAndConfirm = async () => {
    if (!selectedAccount) {
      console.error('No account selected');
      return;
    }
    setIsButtonDisabled(true);

    const transport = await Transport.create();

    if (!transport) {
      setIsConnectSuccess(false);
      setIsConnectFailed(true);
      setIsButtonDisabled(false);
      return;
    }

    setIsConnectSuccess(true);
    await ledgerDelay(1500);
    setCurrentStepIndex(1);

    const profile = {
      stxAddress: {
        mainnet: selectedAccount.stxAddress,
        testnet: publicKeyToAddress(AddressVersion.MainnetSingleSig, {
          data: Buffer.from(selectedAccount.stxPublicKey, 'hex'),
          type: StacksMessageType.PublicKey,
        }),
      },
    };

    try {
      const authResponse = await handleLedgerStxJWTAuth(transport, selectedAccount.id, profile);
      setIsTxApproved(true);
      await ledgerDelay(1500);
      chrome.tabs.sendMessage(+(params.get('tabId') ?? '0'), {
        source: MESSAGE_SOURCE,
        payload: {
          authenticationRequest: authRequestToken,
          authenticationResponse: authResponse,
        },
        method: 'authenticationResponse',
      });
      window.close();
    } catch (e) {
      console.error(e);
      setIsTxRejected(true);
      setIsButtonDisabled(false);
    } finally {
      await transport.close();
    }
  };

  const handleRetry = async () => {
    setIsTxRejected(false);
    setIsConnectSuccess(false);
    setCurrentStepIndex(0);
  };

  return (
    <ConfirmScreen
      onConfirm={confirmCallback}
      onCancel={cancelCallback}
      confirmText={t('CONNECT_BUTTON')}
      cancelText={t('CANCEL_BUTTON')}
      loading={loading}
      disabled={isHardwareAccount(selectedAccount)}
    >
      <AccountHeaderComponent />
      <MainContainer>
        <TopImage src={getDappLogo()} alt="Dapp Logo" />
        <FunctionTitle>{t('TITLE')}</FunctionTitle>
        <DappTitle>{`${t('REQUEST_TOOLTIP')} ${authRequest.payload.appDetails?.name}`}</DappTitle>
        {isHardwareAccount(selectedAccount) && (
          <InfoContainerWrapper>
            <InfoContainer bodyText="The selected account does not support Stacks authentication. Switch to a different account to authenticate with Stacks." />
          </InfoContainerWrapper>
        )}
      </MainContainer>
      <BottomModal header="" visible={isModalVisible} onClose={() => setIsModalVisible(false)}>
        {currentStepIndex === 0 && (
          <LedgerConnectionView
            title={t('LEDGER.CONNECT.TITLE')}
            text={t('LEDGER.CONNECT.SUBTITLE')}
            titleFailed={t('LEDGER.CONNECT.ERROR_TITLE')}
            textFailed={t('LEDGER.CONNECT.ERROR_SUBTITLE')}
            imageDefault={LedgerConnectDefault}
            isConnectSuccess={isConnectSuccess}
            isConnectFailed={isConnectFailed}
          />
        )}
        {currentStepIndex === 1 && (
          <LedgerConnectionView
            title={t('LEDGER.CONFIRM.TITLE')}
            text={t('LEDGER.CONFIRM.SUBTITLE')}
            titleFailed={t('LEDGER.CONFIRM.ERROR_TITLE')}
            textFailed={t('LEDGER.CONFIRM.ERROR_SUBTITLE')}
            imageDefault={LedgerConnectDefault}
            isConnectSuccess={isTxApproved}
            isConnectFailed={isTxRejected}
          />
        )}
        <SuccessActionsContainer>
          <ActionButton
            onPress={isTxRejected || isConnectFailed ? handleRetry : handleConnectAndConfirm}
            text={t(isTxRejected || isConnectFailed ? 'LEDGER.RETRY_BUTTON' : 'CONNECT_BUTTON')}
            disabled={isButtonDisabled}
            processing={isButtonDisabled}
          />
          <ActionButton onPress={cancelCallback} text={t('CANCEL_BUTTON')} transparent />
        </SuccessActionsContainer>
      </BottomModal>
    </ConfirmScreen>
  );
}

export default AuthenticationRequest;
