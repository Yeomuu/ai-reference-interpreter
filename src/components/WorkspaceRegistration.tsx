/** Source registration marks shared by every workspace; never intercept input. */
export default function WorkspaceRegistration({ extraDivider = false }: { extraDivider?: boolean }) {
  return <div className="workspace-registration" aria-hidden="true">
    <img className="workspace-pin workspace-pin--top-left" src="/figma/source/corner-left.svg" alt="" />
    <img className="workspace-pin workspace-pin--bottom-left" src="/figma/source/corner-left.svg" alt="" />
    <img className="workspace-pin workspace-pin--top-right" src="/figma/source/corner-right.svg" alt="" />
    <img className="workspace-pin workspace-pin--bottom-right" src="/figma/source/corner-right.svg" alt="" />
    <img className="workspace-pin workspace-pin--center-top" src="/figma/source/center-top.svg" alt="" />
    <img className="workspace-pin workspace-pin--center-bottom" src="/figma/source/center-bottom.svg" alt="" />
    {extraDivider && <><img className="workspace-pin workspace-pin--left-divider-top" src="/figma/source/center-top.svg" alt="" />
      <img className="workspace-pin workspace-pin--left-divider-bottom" src="/figma/source/center-bottom.svg" alt="" /></>}
  </div>;
}
