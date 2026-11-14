type Props = {
  name: string
}

export const SectionName: React.FC<Props> = ({ name }) => {
  return <div className="mb-2 text-sm text-gray-500">{name}</div>
}
