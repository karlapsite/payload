'use client'

import type { BlocksFieldProps, FormProps } from '@payloadcms/ui'

import {
  Collapsible,
  Form,
  Pill,
  RenderMappedComponent,
  SectionTitle,
  ShimmerEffect,
  useConfig,
  useDocumentInfo,
  useFieldProps,
  useFormSubmitted,
  useTranslation,
} from '@payloadcms/ui'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

const baseClass = 'lexical-block'
import type { FormState } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { getFormState } from '@payloadcms/ui/shared'
import { v4 as uuid } from 'uuid'

import type { BlockFields } from '../../server/nodes/BlocksNode.js'

import { useEditorConfigContext } from '../../../../lexical/config/client/EditorConfigProvider.js'
import { BlockContent } from './BlockContent.js'
import './index.scss'

type Props = {
  children?: React.ReactNode
  formData: BlockFields
  nodeKey?: string
}

export const BlockComponent: React.FC<Props> = (props) => {
  const { formData, nodeKey } = props
  const config = useConfig()
  const submitted = useFormSubmitted()
  const { id } = useDocumentInfo()
  const { path, schemaPath } = useFieldProps()
  const { field: parentLexicalRichTextField } = useEditorConfigContext()

  const [initialState, setInitialState] = useState<FormState | false>(false)
  const {
    field: { richTextComponentMap },
  } = useEditorConfigContext()

  const schemaFieldsPath = `${schemaPath}.lexical_internal_feature.blocks.lexical_blocks.lexical_blocks.${formData.blockType}`

  const componentMapRenderedBlockPath = `lexical_internal_feature.blocks.fields.lexical_blocks`
  const mappedBlock = richTextComponentMap.get(componentMapRenderedBlockPath)[0]

  const blockFieldComponentProps: Omit<BlocksFieldProps, 'indexPath' | 'permissions'> =
    mappedBlock.fieldComponentProps

  const reducedBlock = blockFieldComponentProps.blocks.find(
    (block) => block.slug === formData.blockType,
  )
  const fieldMap = reducedBlock.fieldMap

  // Field Schema
  useEffect(() => {
    const awaitInitialState = async () => {
      const state = await getFormState({
        apiRoute: config.routes.api,
        body: {
          id,
          data: formData,
          operation: 'update',
          schemaPath: schemaFieldsPath,
        },
        serverURL: config.serverURL,
      })

      if (state) {
        setInitialState({
          ...state,
          blockName: {
            initialValue: '',
            passesCondition: true,
            valid: true,
            value: formData.blockName,
          },
        })
      }
    }

    if (formData) {
      void awaitInitialState()
    }
  }, [config.routes.api, config.serverURL, schemaFieldsPath, id])

  const onChange: FormProps['onChange'][0] = useCallback(
    async ({ formState: prevFormState }) => {
      const formState = await getFormState({
        apiRoute: config.routes.api,
        body: {
          id,
          formState: prevFormState,
          operation: 'update',
          schemaPath: schemaFieldsPath,
        },
        serverURL: config.serverURL,
      })

      return {
        ...formState,
        blockName: {
          initialValue: '',
          passesCondition: true,
          valid: true,
          value: formData.blockName,
        },
      }
    },

    [config.routes.api, config.serverURL, schemaFieldsPath, id, formData.blockName],
  )
  const { i18n } = useTranslation()

  const classNames = [`${baseClass}__row`, `${baseClass}__row--no-errors`].filter(Boolean).join(' ')

  // Memoized Form JSX
  const formContent = useMemo(() => {
    return reducedBlock && initialState !== false ? (
      <Form
        beforeSubmit={[onChange]}
        // @ts-expect-error TODO: Fix this
        fields={fieldMap}
        initialState={initialState}
        onChange={[onChange]}
        submitted={submitted}
        uuid={uuid()}
      >
        <BlockContent
          baseClass={baseClass}
          field={parentLexicalRichTextField}
          formData={formData}
          formSchema={Array.isArray(fieldMap) ? fieldMap : []}
          nodeKey={nodeKey}
          path={`${path}.lexical_internal_feature.blocks.${formData.blockType}`}
          reducedBlock={reducedBlock}
          schemaPath={schemaFieldsPath}
        />
      </Form>
    ) : (
      <Collapsible
        className={classNames}
        collapsibleStyle="default"
        header={
          reducedBlock.LabelComponent?.Component ? (
            <RenderMappedComponent
              clientProps={{ blockKind: 'lexicalBlock', formData }}
              component={reducedBlock.LabelComponent}
            />
          ) : (
            <div className={`${baseClass}__block-header`}>
              <div>
                <Pill
                  className={`${baseClass}__block-pill ${baseClass}__block-pill-${formData?.blockType}`}
                  pillStyle="white"
                >
                  {reducedBlock && typeof reducedBlock.labels.singular === 'string'
                    ? getTranslation(reducedBlock.labels.singular, i18n)
                    : reducedBlock.slug}
                </Pill>
                <SectionTitle path="blockName" readOnly={parentLexicalRichTextField?.readOnly} />
              </div>
            </div>
          )
        }
        key={0}
      >
        <ShimmerEffect height="35vh" />
      </Collapsible>
    )
  }, [
    classNames,
    fieldMap,
    parentLexicalRichTextField,
    nodeKey,
    i18n,
    reducedBlock.LabelComponent,
    submitted,
    initialState,
    reducedBlock,
    onChange,
    schemaFieldsPath,
    path,
  ]) // Adding formData to the dependencies here might break it
  return <div className={baseClass + ' ' + baseClass + '-' + formData.blockType}>{formContent}</div>
}
