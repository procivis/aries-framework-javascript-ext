import type { Agent, CredentialState, RecordDeletedEvent, RecordUpdatedEvent } from '@aries-framework/core'

import { filterByRecordType, RepositoryEventTypes, CredentialExchangeRecord } from '@aries-framework/core'
import * as React from 'react'
import { createContext, useState, useEffect, useContext, useMemo } from 'react'

interface CredentialContextInterface {
  loading: boolean
  credentials: CredentialExchangeRecord[]
}

const CredentialContext = createContext<CredentialContextInterface | undefined>(undefined)

export const useCredentials = () => {
  const credentialContext = useContext(CredentialContext)
  if (!credentialContext) {
    throw new Error('useCredentials must be used within a CredentialContextProvider')
  }
  return credentialContext
}

export const useCredentialById = (id: string): CredentialExchangeRecord | undefined => {
  const { credentials } = useCredentials()
  return credentials.find((c: CredentialExchangeRecord) => c.id === id)
}

export const useCredentialByState = (state: CredentialState): CredentialExchangeRecord[] => {
  const { credentials } = useCredentials()
  const filteredCredentials = useMemo(
    () => credentials.filter((c: CredentialExchangeRecord) => c.state === state),
    [credentials, state]
  )
  return filteredCredentials
}

interface Props {
  agent: Agent | undefined
}

const CredentialProvider: React.FC<Props> = ({ agent, children }) => {
  const [credentialState, setCredentialState] = useState<CredentialContextInterface>({
    credentials: [],
    loading: true,
  })

  const setInitialState = async () => {
    if (agent) {
      const credentials = await agent.credentials.getAll()
      setCredentialState({ credentials, loading: false })
    }
  }

  useEffect(() => {
    setInitialState()
  }, [agent])

  useEffect(() => {
    if (!credentialState.loading) {
      const updatedListener = (event: RecordUpdatedEvent<CredentialExchangeRecord>) => {
        const newCredentialsState = [...credentialState.credentials]
        const index = newCredentialsState.findIndex((credential) => credential.id === event.payload.record.id)
        if (index > -1) {
          newCredentialsState[index] = event.payload.record
        } else {
          newCredentialsState.unshift(event.payload.record)
        }

        setCredentialState({
          loading: credentialState.loading,
          credentials: newCredentialsState,
        })
      }

      const deletedListener = (event: RecordDeletedEvent<CredentialExchangeRecord>) => {
        const newCredentialsState = [
          ...credentialState.credentials.filter((credential) => credential.id != event.payload.record.id),
        ]
        setCredentialState({
          loading: credentialState.loading,
          credentials: newCredentialsState,
        })
      }

      const updateSubscription = agent?.events
        .observable(RepositoryEventTypes.RecordUpdated)
        .pipe(filterByRecordType(CredentialExchangeRecord.type))
        .subscribe((e) => updatedListener(e as RecordUpdatedEvent<CredentialExchangeRecord>))

      const deleteSubscription = agent?.events
        .observable(RepositoryEventTypes.RecordDeleted)
        .pipe(filterByRecordType(CredentialExchangeRecord.type))
        .subscribe((e) => deletedListener(e as RecordDeletedEvent<CredentialExchangeRecord>))

      return () => {
        updateSubscription?.unsubscribe()
        deleteSubscription?.unsubscribe()
      }
    }
  }, [credentialState, agent])

  return <CredentialContext.Provider value={credentialState}>{children}</CredentialContext.Provider>
}

export default CredentialProvider
