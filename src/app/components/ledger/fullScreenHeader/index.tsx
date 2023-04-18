import styled from 'styled-components';

import XverseLogoSVG from '@assets/img/full_logo_horizontal.svg';

const HeaderRow = styled.div((props) => ({
  position: 'absolute',
  width: '100%',
  top: props.theme.spacing(5),
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '32px 100px',
}));

const XverseLogo = styled.img((props) => ({
  height: '30px',
}));

const VersionText = styled.p((props) => ({
  ...props.theme.body_xs,
  fontSize: '18px',
  color: props.theme.colors.white[200],
}));

function FullScreenHeader() {
  return (
    <HeaderRow>
      <XverseLogo src={XverseLogoSVG} />
      <VersionText>V1.0.0</VersionText>
    </HeaderRow>
  );
}

export default FullScreenHeader;
