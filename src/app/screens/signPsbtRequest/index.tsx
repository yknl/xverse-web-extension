import { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@components/button';
import useSignPsbtTx from '@hooks/useSignPsbtTx';
import useWalletSelector from '@hooks/useWalletSelector';
import { parsePsbt, psbtBase64ToHex } from '@secretkeylabs/xverse-core/transactions/psbt';
import { useTranslation } from 'react-i18next';
import IconOrdinal from '@assets/img/transactions/ordinal.svg';
import styled from 'styled-components';
import {
  getBtcFiatEquivalent,
  satsToBtc,
  signIncomingSingleSigPSBT,
} from '@secretkeylabs/xverse-core';
import BigNumber from 'bignumber.js';
import InputOutputComponent from '@components/confirmBtcTransactionComponent/inputOutputComponent';
import TransactionDetailComponent from '@components/transactionDetailComponent';
import AccountHeaderComponent from '@components/accountHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import RecipientComponent from '@components/recipientComponent';
import Transport from '@ledgerhq/hw-transport-webusb';
import { Transport as TransportType } from '@secretkeylabs/xverse-core/ledger/types';
import InfoContainer from '@components/infoContainer';
import { NumericFormat } from 'react-number-format';
import { MoonLoader } from 'react-spinners';
import useDetectOrdinalInSignPsbt from '@hooks/useDetectOrdinalInSignPsbt';
import { isLedgerAccount } from '@utils/helper';
import BottomModal from '@components/bottomModal';
import LedgerConnectionView from '@components/ledger/connectLedgerView';
import { ExternalSatsMethods, MESSAGE_SOURCE } from '@common/types/message-types';
import ledgerConnectDefaultIcon from '@assets/img/ledger/ledger_connect_default.svg';
import ledgerConnectBtcIcon from '@assets/img/ledger/ledger_import_connect_btc.svg';
import { ledgerDelay } from '@common/utils/ledger';
import { decodeToken } from 'jsontokens';
import { SignTransactionOptions } from 'sats-connect';
import useBtcClient from '@hooks/useBtcClient';
import { findLedgerAccountId } from '@utils/ledger';
import OrdinalDetailComponent from './ordinalDetailComponent';

const OuterContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  &::-webkit-scrollbar {
    display: none;
  }
`;

const Container = styled.div((props) => ({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  marginTop: props.theme.spacing(11),
  marginLeft: props.theme.spacing(8),
  marginRight: props.theme.spacing(8),
}));

const LoaderContainer = styled.div((props) => ({
  display: 'flex',
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: props.theme.spacing(12),
}));

const ButtonContainer = styled.div((props) => ({
  display: 'flex',
  flexDirection: 'row',
  marginLeft: props.theme.spacing(8),
  marginRight: props.theme.spacing(8),
  marginBottom: props.theme.spacing(20),
}));

const TransparentButtonContainer = styled.div((props) => ({
  marginLeft: props.theme.spacing(2),
  marginRight: props.theme.spacing(2),
  width: '100%',
}));

const ReviewTransactionText = styled.h1((props) => ({
  ...props.theme.headline_s,
  color: props.theme.colors.white[0],
  marginBottom: props.theme.spacing(12),
  textAlign: 'left',
}));

const SuccessActionsContainer = styled.div((props) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: props.theme.spacing(6),
  paddingLeft: props.theme.spacing(8),
  paddingRight: props.theme.spacing(8),
  marginBottom: props.theme.spacing(20),
  marginTop: props.theme.spacing(20),
}));

function SignPsbtRequest() {
  const { btcAddress, ordinalsAddress, selectedAccount, network, btcFiatRate, ledgerAccountsList } =
    useWalletSelector();
  const navigate = useNavigate();
  const { t } = useTranslation('translation', { keyPrefix: 'CONFIRM_TRANSACTION' });
  const { t: signatureRequestTranslate } = useTranslation('translation', {
    keyPrefix: 'SIGNATURE_REQUEST',
  });
  const [expandInputOutputView, setExpandInputOutputView] = useState(false);
  const { payload, confirmSignPsbt, cancelSignPsbt, getSigningAddresses } = useSignPsbtTx();
  const [isSigning, setIsSigning] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [isConnectSuccess, setIsConnectSuccess] = useState(false);
  const [isConnectFailed, setIsConnectFailed] = useState(false);
  const [isTxApproved, setIsTxApproved] = useState(false);
  const [isTxRejected, setIsTxRejected] = useState(false);
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const tabId = params.get('tabId') ?? '0';
  const requestToken = params.get('signPsbtRequest') ?? '';
  const request = decodeToken(requestToken) as any as SignTransactionOptions;
  const btcClient = useBtcClient();

  const handlePsbtParsing = useCallback(() => {
    try {
      return parsePsbt(selectedAccount!, payload.inputsToSign, payload.psbtBase64, network.type);
    } catch (err) {
      return '';
    }
  }, [selectedAccount, payload.psbtBase64]);

  const parsedPsbt = useMemo(() => handlePsbtParsing(), [handlePsbtParsing]);
  const { loading, ordinalInfoData, userReceivesOrdinal } = useDetectOrdinalInSignPsbt(parsedPsbt);
  const signingAddresses = useMemo(
    () => getSigningAddresses(payload.inputsToSign),
    [payload.inputsToSign],
  );

  const checkIfMismatch = () => {
    if (!parsedPsbt) {
      navigate('/tx-status', {
        state: {
          txid: '',
          currency: 'BTC',
          errorTitle: t('PSBT_CANT_PARSE_ERROR_TITLE'),
          error: t('PSBT_CANT_PARSE_ERROR_DESCRIPTION'),
          browserTx: true,
        },
      });
    }
    if (payload.network.type !== network.type) {
      navigate('/tx-status', {
        state: {
          txid: '',
          currency: 'BTC',
          error: t('NETWORK_MISMATCH'),
          browserTx: true,
        },
      });
    }
    if (payload.inputsToSign) {
      payload.inputsToSign.forEach((input) => {
        if (input.address !== btcAddress && input.address !== ordinalsAddress) {
          navigate('/tx-status', {
            state: {
              txid: '',
              currency: 'STX',
              error: t('ADDRESS_MISMATCH'),
              browserTx: true,
            },
          });
        }
      });
    }
  };

  useEffect(() => {
    checkIfMismatch();
  }, []);

  const onSignPsbtConfirmed = async () => {
    try {
      if (isLedgerAccount(selectedAccount)) {
        setIsModalVisible(true);
        return;
      }

      setIsSigning(true);
      const response = await confirmSignPsbt();
      setIsSigning(false);
      if (payload.broadcast) {
        navigate('/tx-status', {
          state: {
            txid: response.txId,
            currency: 'BTC',
            error: '',
            browserTx: true,
          },
        });
      } else {
        window.close();
      }
    } catch (err) {
      if (err instanceof Error) {
        navigate('/tx-status', {
          state: {
            txid: '',
            currency: 'BTC',
            errorTitle: !payload.broadcast ? t('PSBT_CANT_SIGN_ERROR_TITLE') : '',
            error: err.message,
            browserTx: true,
          },
        });
      }
    }
  };

  const onCancelClick = async () => {
    cancelSignPsbt();
    window.close();
  };

  const expandInputOutputSection = () => {
    setExpandInputOutputView(!expandInputOutputView);
  };

  const handleLedgerPsbtSigning = async (transport: TransportType) => {
    const accountId = await findLedgerAccountId({
      transport,
      id: selectedAccount?.id,
      ledgerAccountsList,
    });

    if (accountId === -1) {
      throw new Error('Account not found');
    }

    const signingResponse = await signIncomingSingleSigPSBT(
      transport,
      network.type,
      accountId,
      payload.inputsToSign,
      payload.psbtBase64,
      payload.broadcast,
    );

    let txId: string = '';
    if (request.payload.broadcast) {
      const txHex = psbtBase64ToHex(signingResponse);
      const response = await btcClient.sendRawTransaction(txHex);
      txId = response.tx.hash;
    }

    const signingMessage = {
      source: MESSAGE_SOURCE,
      method: ExternalSatsMethods.signPsbtResponse,
      payload: {
        signPsbtRequest: requestToken,
        signPsbtResponse: {
          psbtBase64: signingResponse,
          txId,
        },
      },
    };
    chrome.tabs.sendMessage(+tabId, signingMessage);

    return {
      txId,
      signingResponse,
    };
  };

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

    try {
      const response = await handleLedgerPsbtSigning(transport);

      if (payload.broadcast) {
        navigate('/tx-status', {
          state: {
            txid: response.txId,
            currency: 'BTC',
            error: '',
            browserTx: true,
          },
        });
      } else {
        window.close();
      }
    } catch (err) {
      console.error(err);
      setIsTxRejected(true);
    } finally {
      await transport.close();
      setIsButtonDisabled(false);
    }
  };

  const handleRetry = async () => {
    setIsTxRejected(false);
    setIsConnectSuccess(false);
    setCurrentStepIndex(0);
  };

  const cancelCallback = () => {
    window.close();
  };

  const getSatsAmountString = (sats: BigNumber) => (
    <NumericFormat
      value={sats.toString()}
      displayType="text"
      thousandSeparator
      suffix={` ${t('SATS')}`}
    />
  );

  return (
    <>
      <AccountHeaderComponent disableMenuOption disableAccountSwitch disableCopy />
      {loading ? (
        <LoaderContainer>
          <MoonLoader color="white" size={50} />
        </LoaderContainer>
      ) : (
        <>
          <OuterContainer>
            <Container>
              <ReviewTransactionText>{t('REVIEW_TRANSACTION')}</ReviewTransactionText>
              {!payload.broadcast && <InfoContainer bodyText={t('PSBT_NO_BROADCAST_DISCLAIMER')} />}
              {ordinalInfoData &&
                ordinalInfoData.map((ordinalData) => (
                  <OrdinalDetailComponent
                    ordinalInscription={`Inscription ${ordinalData?.number}`}
                    icon={IconOrdinal}
                    title={t('ORDINAL')}
                    ordinal={ordinalData}
                    ordinalDetail={ordinalData?.content_type}
                    heading={userReceivesOrdinal ? t('YOU_WILL_RECEIVE') : t('YOU_WILL_TRANSFER')}
                  />
                ))}
              <RecipientComponent
                value={`${satsToBtc(new BigNumber(parsedPsbt?.netAmount))
                  .toString()
                  .replace('-', '')}`}
                currencyType="BTC"
                title={t('AMOUNT')}
                heading={parsedPsbt?.netAmount < 0 ? t('YOU_WILL_TRANSFER') : t('YOU_WILL_RECEIVE')}
              />
              <InputOutputComponent
                parsedPsbt={parsedPsbt}
                isExpanded={expandInputOutputView}
                address={signingAddresses}
                onArrowClick={expandInputOutputSection}
              />

              <TransactionDetailComponent title={t('NETWORK')} value={network.type} />
              {payload.broadcast ? (
                <TransactionDetailComponent
                  title={t('FEES')}
                  value={getSatsAmountString(new BigNumber(parsedPsbt?.fees))}
                  subValue={getBtcFiatEquivalent(new BigNumber(parsedPsbt?.fees), btcFiatRate)}
                />
              ) : null}
            </Container>
          </OuterContainer>
          <ButtonContainer>
            <TransparentButtonContainer>
              <ActionButton text={t('CANCEL')} transparent onPress={onCancelClick} />
            </TransparentButtonContainer>
            <ActionButton
              text={t('CONFIRM')}
              onPress={onSignPsbtConfirmed}
              processing={isSigning}
            />
          </ButtonContainer>
        </>
      )}
      <BottomModal header="" visible={isModalVisible} onClose={() => setIsModalVisible(false)}>
        {currentStepIndex === 0 && (
          <LedgerConnectionView
            title={signatureRequestTranslate('LEDGER.CONNECT.TITLE')}
            text={signatureRequestTranslate('LEDGER.CONNECT.SUBTITLE', { name: 'Bitcoin' })}
            titleFailed={signatureRequestTranslate('LEDGER.CONNECT.ERROR_TITLE')}
            textFailed={signatureRequestTranslate('LEDGER.CONNECT.ERROR_SUBTITLE')}
            imageDefault={ledgerConnectBtcIcon}
            isConnectSuccess={isConnectSuccess}
            isConnectFailed={isConnectFailed}
          />
        )}
        {currentStepIndex === 1 && (
          <LedgerConnectionView
            title={signatureRequestTranslate('LEDGER.CONFIRM.TITLE')}
            text={signatureRequestTranslate('LEDGER.CONFIRM.SUBTITLE')}
            titleFailed={signatureRequestTranslate('LEDGER.CONFIRM.ERROR_TITLE')}
            textFailed={signatureRequestTranslate('LEDGER.CONFIRM.ERROR_SUBTITLE')}
            imageDefault={ledgerConnectDefaultIcon}
            isConnectSuccess={isTxApproved}
            isConnectFailed={isTxRejected}
          />
        )}
        <SuccessActionsContainer>
          <ActionButton
            onPress={isTxRejected || isConnectFailed ? handleRetry : handleConnectAndConfirm}
            text={signatureRequestTranslate(
              isTxRejected || isConnectFailed ? 'LEDGER.RETRY_BUTTON' : 'LEDGER.CONNECT_BUTTON',
            )}
            disabled={isButtonDisabled}
            processing={isButtonDisabled}
          />
          <ActionButton
            onPress={cancelCallback}
            text={signatureRequestTranslate('LEDGER.CANCEL_BUTTON')}
            transparent
          />
        </SuccessActionsContainer>
      </BottomModal>
    </>
  );
}

export default SignPsbtRequest;
